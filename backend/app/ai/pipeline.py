"""
End-to-end AI inference pipeline — fully integrated, no mocks.

Per-camera processing flow:
  ┌─────────────────────────────────────────────────────────────────┐
  │  Frame capture (OpenCV VideoCapture / RTSP)                     │
  │    ↓                                                            │
  │  Preprocess (CLAHE, denoise)                                    │
  │    ↓                                                            │
  │  YOLOv8 vehicle detection                                       │
  │    ↓                                                            │
  │  Per-vehicle: plate region detection                            │
  │    ↓                                                            │
  │  Plate crop → heavy preprocessing (deskew, sharpen, binarize)  │
  │    ↓                                                            │
  │  OCR (EasyOCR / PaddleOCR / Tesseract)                        │
  │    ↓                                                            │
  │  Database vehicle lookup (exact → fuzzy)                        │
  │    ↓                                                            │
  │  Document expiry validation                                     │
  │    ↓                                                            │
  │  Evidence save (annotated frame + plate crop)                  │
  │    ↓                                                            │
  │  Persist Detection row in PostgreSQL                           │
  │    ↓                                                            │
  │  If violation → queue Celery challan task                       │
  │    ↓                                                            │
  │  Broadcast WebSocket event (camera room + global room)         │
  └─────────────────────────────────────────────────────────────────┘

Every stage has logging. Failures in one stage do NOT crash the pipeline;
they are recorded and the next frame is processed.
"""

import asyncio
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Coroutine, Dict, List, Optional

import cv2
import numpy as np

from app.ai.detector import vehicle_detector, DetectionResult
from app.ai.evidence_store import save_frame_async, save_plate_crop_async
from app.ai.ocr import plate_ocr, OCR_MIN_CONFIDENCE
from app.ai.preprocessor import preprocess_frame, preprocess_plate_crop, extract_plate_region
from app.core.config import settings
from app.core.constants import (
    CameraStatus,
    ChallanStatus,
    DetectionStatus,
    FINE_AMOUNTS,
    WS_EVENTS,
    CONFIDENCE_THRESHOLDS,
)
from app.core.logging import get_logger
from app.db.session import get_db_context
from app.services.expiry_checker import check_vehicle_expiry, check_unknown_vehicle

logger = get_logger(__name__)

EventCallback = Callable[[Dict[str, Any]], Coroutine]


class InferencePipeline:
    """
    Manages one camera's full detection loop.
    Instantiated once per camera; runs until stop() is called.
    """

    def __init__(
        self,
        camera_id: str,
        stream_url: str,
        db_camera_id: str,            # UUID in the cameras table
        event_callback: Optional[EventCallback] = None,
    ) -> None:
        self.camera_id = camera_id        # Human-readable ID like "CAM_001"
        self.stream_url = stream_url
        self.db_camera_id = db_camera_id
        self.event_callback = event_callback

        self._running = False
        self._cap: Optional[cv2.VideoCapture] = None
        self._frame_count = 0
        self._fps_window: List[float] = []   # Timestamps for FPS calculation
        self._error_streak = 0               # Consecutive read errors
        self._max_error_streak = 30          # Reconnect after this many consecutive failures

    # ── Lifecycle ─────────────────────────────────────────────────

    async def start(self) -> None:
        self._running = True
        logger.info("pipeline_starting", camera_id=self.camera_id, stream=self.stream_url)
        try:
            await self._run_loop()
        except asyncio.CancelledError:
            logger.info("pipeline_cancelled", camera_id=self.camera_id)
        except Exception as e:
            logger.error("pipeline_crashed", camera_id=self.camera_id, error=str(e))
        finally:
            self._cleanup()

    def stop(self) -> None:
        self._running = False
        logger.info("pipeline_stop_requested", camera_id=self.camera_id)

    # ── Main loop ─────────────────────────────────────────────────

    async def _run_loop(self) -> None:
        loop = asyncio.get_event_loop()
        self._cap = await loop.run_in_executor(None, self._open_capture, self.stream_url)

        if not self._cap or not self._cap.isOpened():
            logger.error(
                "stream_open_failed",
                camera_id=self.camera_id,
                url=self.stream_url,
                hint="Verify RTSP URL, camera power, and network connectivity",
            )
            await self._update_camera_status(CameraStatus.ERROR)
            return

        await self._update_camera_status(CameraStatus.ACTIVE)
        logger.info("stream_opened", camera_id=self.camera_id)

        while self._running:
            t_frame_start = time.perf_counter()

            ret, frame = await loop.run_in_executor(None, self._cap.read)

            if not ret:
                self._error_streak += 1
                logger.warning(
                    "frame_read_failed",
                    camera_id=self.camera_id,
                    consecutive_errors=self._error_streak,
                )
                if self._error_streak >= self._max_error_streak:
                    logger.error(
                        "stream_disconnected_reconnecting",
                        camera_id=self.camera_id,
                        streak=self._error_streak,
                    )
                    await self._reconnect()
                else:
                    await asyncio.sleep(0.1)
                continue

            self._error_streak = 0
            self._frame_count += 1

            # FPS tracking (sliding 30-frame window)
            now = time.perf_counter()
            self._fps_window.append(now)
            if len(self._fps_window) > 30:
                self._fps_window.pop(0)

            # Frame skipping to avoid saturating CPU/GPU
            if self._frame_count % max(1, settings.FRAME_SKIP) != 0:
                continue

            # Process frame (non-blocking via executor)
            try:
                await self._process_frame(frame, t_frame_start)
            except Exception as e:
                logger.error(
                    "frame_processing_exception",
                    camera_id=self.camera_id,
                    frame=self._frame_count,
                    error=str(e),
                )

    # ── Frame processing ─────────────────────────────────────────

    async def _process_frame(self, frame: np.ndarray, t_start: float) -> None:
        loop = asyncio.get_event_loop()

        # Step 1: Preprocess for better YOLO accuracy
        preprocessed = await loop.run_in_executor(None, preprocess_frame, frame)

        # Step 2: Detect vehicles
        detections = await vehicle_detector.detect_async(preprocessed)

        if not detections:
            return  # Nothing to process

        # Step 3: Process each detected vehicle
        for detection in detections:
            if detection.confidence < CONFIDENCE_THRESHOLDS["vehicle_detection"]:
                logger.debug(
                    "vehicle_below_confidence_threshold",
                    camera_id=self.camera_id,
                    confidence=detection.confidence,
                    threshold=CONFIDENCE_THRESHOLDS["vehicle_detection"],
                )
                continue

            await self._process_detection(frame, detection, detections, t_start)

    async def _process_detection(
        self,
        frame: np.ndarray,
        detection: DetectionResult,
        all_detections: List[DetectionResult],
        t_start: float,
    ) -> None:
        """Full pipeline for one detected vehicle."""
        loop = asyncio.get_event_loop()
        detection_id = str(uuid.uuid4())
        dt_now = datetime.now(timezone.utc)

        # ── Step 3a: Extract and read plate ──────────────────────
        plate_text: Optional[str] = None
        ocr_result = None
        plate_crop: Optional[np.ndarray] = None

        if detection.plate_bbox and detection.plate_confidence >= CONFIDENCE_THRESHOLDS["plate_detection"]:
            raw_crop = extract_plate_region(frame, detection.plate_bbox.as_tuple, padding=8)

            if raw_crop.size > 0:
                plate_crop = raw_crop.copy()

                # Heavy preprocessing for OCR
                try:
                    processed_crop = await loop.run_in_executor(
                        None, preprocess_plate_crop, raw_crop
                    )
                except Exception as e:
                    logger.warning("plate_preprocessing_failed", error=str(e))
                    processed_crop = raw_crop

                # OCR
                ocr_result = await loop.run_in_executor(
                    None, plate_ocr.read_plate, processed_crop
                )

                if ocr_result.confidence >= OCR_MIN_CONFIDENCE and ocr_result.is_valid_format:
                    plate_text = ocr_result.text
                    logger.info(
                        "plate_read_success",
                        camera_id=self.camera_id,
                        plate=plate_text,
                        confidence=round(ocr_result.confidence, 3),
                        engine=ocr_result.engine_used,
                    )
                else:
                    logger.warning(
                        "plate_read_low_confidence_or_invalid_format",
                        camera_id=self.camera_id,
                        text=ocr_result.text,
                        confidence=round(ocr_result.confidence, 3),
                        valid_format=ocr_result.is_valid_format,
                    )
        else:
            logger.debug(
                "plate_detection_below_threshold",
                camera_id=self.camera_id,
                plate_confidence=detection.plate_confidence,
                threshold=CONFIDENCE_THRESHOLDS["plate_detection"],
            )

        # ── Step 3b: Save evidence to disk ────────────────────────
        frame_path = await save_frame_async(
            frame=frame,
            camera_id=self.camera_id,
            detection_id=detection_id,
            detections=all_detections,
            dt=dt_now,
        )

        plate_path: Optional[str] = None
        if plate_crop is not None:
            plate_path = await save_plate_crop_async(
                plate_crop=plate_crop,
                camera_id=self.camera_id,
                detection_id=detection_id,
                plate_text=plate_text,
                dt=dt_now,
            )

        # ── Step 3c: Database lookup + expiry check ───────────────
        violation_report = None
        vehicle_db_id: Optional[str] = None

        if plate_text:
            try:
                async with get_db_context() as db:
                    from app.repositories.vehicle_repo import VehicleRepository
                    repo = VehicleRepository(db)

                    vehicle = await repo.get_by_plate(plate_text)

                    if vehicle is None:
                        # Fuzzy fallback
                        candidates = await repo.fuzzy_lookup(plate_text, max_results=1)
                        if candidates:
                            vehicle = candidates[0]
                            logger.info(
                                "fuzzy_plate_match",
                                queried=plate_text,
                                matched=vehicle.plate_number,
                            )

                    if vehicle:
                        vehicle_db_id = str(vehicle.id)
                        violation_report = check_vehicle_expiry(vehicle)
                    else:
                        logger.warning("plate_not_in_registry", plate=plate_text)
                        violation_report = check_unknown_vehicle(plate_text)

            except Exception as e:
                logger.error("vehicle_lookup_failed", plate=plate_text, error=str(e))

        # ── Step 3d: Calculate processing time ────────────────────
        processing_ms = int((time.perf_counter() - t_start) * 1000)
        is_violation = bool(violation_report and violation_report.has_violations)
        violation_type: Optional[str] = None
        if is_violation and violation_report.primary_violation:
            violation_type = violation_report.primary_violation.violation_type

        # ── Step 3e: Persist Detection to database ─────────────────
        try:
            async with get_db_context() as db:
                from app.models.detection import Detection

                det_record = Detection(
                    id=uuid.UUID(detection_id),
                    camera_id=uuid.UUID(self.db_camera_id) if self.db_camera_id else None,
                    vehicle_id=uuid.UUID(vehicle_db_id) if vehicle_db_id else None,
                    detected_plate=plate_text,
                    ocr_confidence=ocr_result.confidence if ocr_result else None,
                    ocr_raw_text=ocr_result.candidates[0].text if ocr_result and ocr_result.candidates else None,
                    vehicle_confidence=detection.confidence,
                    plate_confidence=detection.plate_confidence if detection.plate_bbox else None,
                    vehicle_category=detection.class_name,
                    bounding_box=detection.bbox.as_dict(),
                    plate_bounding_box=detection.plate_bbox.as_dict() if detection.plate_bbox else None,
                    frame_path=frame_path,
                    plate_crop_path=plate_path,
                    frame_number=self._frame_count,
                    timestamp=dt_now,
                    status=DetectionStatus.PROCESSED,
                    is_violation=is_violation,
                    violation_type=violation_type,
                    processing_time_ms=processing_ms,
                    extra_metadata={
                        "fps": self._current_fps(),
                        "ocr_engine": ocr_result.engine_used if ocr_result else None,
                        "ocr_quality_score": round(ocr_result.quality_score, 3) if ocr_result else None,
                        "ocr_candidates": [
                            {"text": c.normalized, "conf": round(c.confidence, 3)}
                            for c in (ocr_result.candidates[:3] if ocr_result else [])
                        ],
                        "warnings": violation_report.warnings if violation_report else [],
                    },
                )
                db.add(det_record)

                # Update camera last_seen + detection counter
                from app.models.camera import Camera
                from sqlalchemy import update
                await db.execute(
                    update(Camera)
                    .where(Camera.camera_id == self.camera_id)
                    .values(
                        last_seen=dt_now,
                        total_detections=Camera.total_detections + 1,
                        status=CameraStatus.ACTIVE,
                    )
                )

        except Exception as e:
            logger.error("detection_persist_failed", detection_id=detection_id, error=str(e))

        # ── Step 3f: Auto-issue challan via Celery ────────────────
        if is_violation and plate_text and violation_report:
            try:
                _enqueue_challan_task(
                    detection_id=detection_id,
                    plate_number=plate_text,
                    violation_report=violation_report,
                    frame_path=frame_path,
                    plate_path=plate_path,
                )
            except Exception as e:
                logger.error("challan_enqueue_failed", detection_id=detection_id, error=str(e))

        # ── Step 3g: Broadcast WebSocket event ───────────────────
        event = _build_ws_event(
            camera_id=self.camera_id,
            detection_id=detection_id,
            detection=detection,
            plate_text=plate_text,
            ocr_result=ocr_result,
            is_violation=is_violation,
            violation_type=violation_type,
            violation_report=violation_report,
            processing_ms=processing_ms,
            frame_number=self._frame_count,
            frame_path=frame_path,
            plate_path=plate_path,
            dt=dt_now,
        )

        if self.event_callback:
            try:
                await self.event_callback(event)
            except Exception as e:
                logger.error("event_callback_failed", error=str(e))

    # ── Helpers ───────────────────────────────────────────────────

    def _open_capture(self, url: str) -> cv2.VideoCapture:
        cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, settings.STREAM_BUFFER_SIZE)
        cap.set(cv2.CAP_PROP_FPS, settings.MAX_FPS)
        # Prefer H.264 decode for GPU-accelerated streams
        if settings.GPU_ENABLED:
            cap.set(cv2.CAP_PROP_HW_ACCELERATION, cv2.VIDEO_ACCELERATION_ANY)
        return cap

    async def _reconnect(self) -> None:
        """Dispose existing capture and re-open after a cooldown."""
        self._cleanup_cap()
        await asyncio.sleep(5)
        loop = asyncio.get_event_loop()
        self._cap = await loop.run_in_executor(None, self._open_capture, self.stream_url)
        self._error_streak = 0
        if not self._cap or not self._cap.isOpened():
            await self._update_camera_status(CameraStatus.ERROR)
            logger.error("reconnect_failed", camera_id=self.camera_id)
        else:
            logger.info("stream_reconnected", camera_id=self.camera_id)

    def _current_fps(self) -> float:
        if len(self._fps_window) < 2:
            return 0.0
        elapsed = self._fps_window[-1] - self._fps_window[0]
        return round(len(self._fps_window) / max(elapsed, 1e-6), 1)

    async def _update_camera_status(self, status: CameraStatus) -> None:
        try:
            async with get_db_context() as db:
                from app.models.camera import Camera
                from sqlalchemy import update
                await db.execute(
                    update(Camera)
                    .where(Camera.camera_id == self.camera_id)
                    .values(status=status)
                )
        except Exception as e:
            logger.error("camera_status_update_failed", camera_id=self.camera_id, error=str(e))

    def _cleanup_cap(self) -> None:
        if self._cap:
            self._cap.release()
            self._cap = None

    def _cleanup(self) -> None:
        self._cleanup_cap()
        logger.info("pipeline_stopped", camera_id=self.camera_id, total_frames=self._frame_count)


# ── Module-level helpers ──────────────────────────────────────────

def _enqueue_challan_task(
    detection_id: str,
    plate_number: str,
    violation_report: Any,
    frame_path: Optional[str],
    plate_path: Optional[str],
) -> None:
    """
    Queues a Celery task to create a challan and send notifications.
    Import is deferred to avoid circular imports at module load time.
    """
    from app.workers.tasks.detection_tasks import process_detection_violation
    process_detection_violation.apply_async(
        kwargs={
            "detection_id": detection_id,
            "plate_number": plate_number,
            "violation_type": violation_report.primary_violation.violation_type,
            "violation_description": violation_report.primary_violation.description,
            "fine_amount": violation_report.total_fine,
            "frame_path": frame_path,
            "plate_path": plate_path,
        },
        queue="ai",
        countdown=2,  # Small delay so the Detection row is committed first
    )
    logger.info(
        "challan_task_enqueued",
        detection_id=detection_id,
        plate=plate_number,
        violation=violation_report.primary_violation.violation_type,
        fine=violation_report.total_fine,
    )


def _build_ws_event(
    camera_id: str,
    detection_id: str,
    detection: DetectionResult,
    plate_text: Optional[str],
    ocr_result: Any,
    is_violation: bool,
    violation_type: Optional[str],
    violation_report: Any,
    processing_ms: int,
    frame_number: int,
    frame_path: Optional[str],
    plate_path: Optional[str],
    dt: datetime,
) -> Dict[str, Any]:
    return {
        "event_type": WS_EVENTS["detection"],
        "camera_id": camera_id,
        "timestamp": dt.isoformat(),
        "detection": {
            "detection_id": detection_id,
            "plate_number": plate_text,
            "vehicle_type": detection.class_name,
            "vehicle_confidence": round(detection.confidence, 3),
            "plate_confidence": round(detection.plate_confidence, 3) if detection.plate_bbox else 0.0,
            "ocr_confidence": round(ocr_result.confidence, 3) if ocr_result else 0.0,
            "ocr_quality_score": round(ocr_result.quality_score, 3) if ocr_result else 0.0,
            "ocr_engine": ocr_result.engine_used if ocr_result else None,
            "is_valid_plate_format": ocr_result.is_valid_format if ocr_result else False,
            "bounding_box": list(detection.bbox.as_tuple),
            "plate_bounding_box": list(detection.plate_bbox.as_tuple) if detection.plate_bbox else None,
            "is_violation": is_violation,
            "violation_type": violation_type,
            "violations": [
                {
                    "type": v.violation_type,
                    "description": v.description,
                    "fine": v.fine_amount,
                    "days_overdue": v.days_overdue,
                }
                for v in (violation_report.violations if violation_report else [])
            ],
            "total_fine": violation_report.total_fine if (violation_report and is_violation) else 0.0,
            "processing_time_ms": processing_ms,
            "frame_number": frame_number,
            "frame_path": frame_path,
            "plate_path": plate_path,
        },
    }


# ── Pipeline manager ──────────────────────────────────────────────

class PipelineManager:
    """Lifecycle manager for all active camera pipelines."""

    def __init__(self) -> None:
        self._pipelines: Dict[str, InferencePipeline] = {}
        self._tasks: Dict[str, asyncio.Task] = {}

    async def start_camera(
        self,
        camera_id: str,
        db_camera_id: str,
        stream_url: str,
        event_callback: Optional[EventCallback] = None,
    ) -> None:
        if camera_id in self._tasks and not self._tasks[camera_id].done():
            logger.warning("camera_pipeline_already_running", camera_id=camera_id)
            return

        pipeline = InferencePipeline(
            camera_id=camera_id,
            stream_url=stream_url,
            db_camera_id=db_camera_id,
            event_callback=event_callback,
        )
        self._pipelines[camera_id] = pipeline
        task = asyncio.create_task(pipeline.start(), name=f"pipeline-{camera_id}")
        self._tasks[camera_id] = task
        logger.info("camera_pipeline_started", camera_id=camera_id)

    async def stop_camera(self, camera_id: str) -> None:
        if pipeline := self._pipelines.get(camera_id):
            pipeline.stop()
        if task := self._tasks.get(camera_id):
            task.cancel()
            try:
                await asyncio.wait_for(asyncio.shield(task), timeout=5.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass
        self._pipelines.pop(camera_id, None)
        self._tasks.pop(camera_id, None)

    async def stop_all(self) -> None:
        for camera_id in list(self._tasks.keys()):
            await self.stop_camera(camera_id)

    def get_active_cameras(self) -> List[str]:
        return [cid for cid, t in self._tasks.items() if not t.done()]

    def is_running(self, camera_id: str) -> bool:
        task = self._tasks.get(camera_id)
        return task is not None and not task.done()

    def pipeline_status(self) -> Dict[str, Any]:
        return {
            cid: {
                "running": not t.done(),
                "fps": self._pipelines[cid]._current_fps() if cid in self._pipelines else 0,
                "frames": self._pipelines[cid]._frame_count if cid in self._pipelines else 0,
                "errors": self._pipelines[cid]._error_streak if cid in self._pipelines else 0,
            }
            for cid, t in self._tasks.items()
        }


pipeline_manager = PipelineManager()
