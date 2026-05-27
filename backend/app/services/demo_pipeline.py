"""
Per-camera real-time AI enforcement pipeline.

Flow per camera (one async task):
    StreamSource ───► YOLO every frame ──► per-vehicle IoU tracker
                                            │
                                            ▼
                                  plate region (YOLO/Haar/positional)
                                            │
                                            ▼
                                  EasyOCR (gated per track)
                                            │
                                            ▼
                              normalize + plate format validation
                                            │
                                            ▼
                       ComplianceEngine (4 concurrent DB checks)
                                            │
                                            ▼
                       Detection + (optional) Challan persistence
                                            │
                                            ▼
                       Evidence snapshot save (frame + plate crop)
                                            │
                                            ▼
                       WS broadcast → demo:{id}, global:detections, global:alerts

Design notes
────────────
1. **Per-track OCR gating** — every new vehicle gets OCR'd on its first
   stable frame (or after 6 frames as a fallback). A *track* is an IoU-
   matched run of detections; once a high-quality plate is locked for a
   track we stop re-OCRing it. This stops the pipeline from looking dead
   when multiple vehicles share the frame.

2. **Visible OCR attempts** — every OCR pass (reliable or not) broadcasts
   an `ocr_attempt` payload. The frontend shows them in a live activity
   feed so the operator sees the AI working, not silence.

3. **Dedupe window** — the same normalized plate from the same camera
   within DEDUPE_WINDOW_S is reported once, not 50 times.

4. **Evidence on disk** — every persisted detection writes an annotated
   full-frame JPEG and a plate-crop JPEG via app.ai.evidence_store.
"""
from __future__ import annotations

import asyncio
import contextlib
import time
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import cv2
import numpy as np

from app.ai.detector import vehicle_detector, BoundingBox, DetectionResult
from app.ai.evidence_store import save_frame_async, save_plate_crop_async
from app.ai.ocr import plate_ocr
from app.ai.preprocessor import preprocess_plate_crop
from app.core.constants import ChallanStatus, DetectionStatus, FINE_AMOUNTS
from app.core.logging import get_logger
from app.db.session import AsyncSessionFactory
from app.models.camera import Camera
from app.models.detection import Detection
from app.models.challan import Challan
from app.models.vehicle import Vehicle
from app.services.compliance_engine import ComplianceReport, assess_compliance
from app.services.stream_manager import StreamSource, stream_registry
from app.websockets.manager import ws_manager
from sqlalchemy import select

logger = get_logger(__name__)


# ── Tunables ─────────────────────────────────────────────────────────
LOOP_TARGET_FPS = 12              # cap the pipeline to keep CPU sane
TRACK_IOU_MATCH = 0.30            # IoU between consecutive frames to consider same track
TRACK_TIMEOUT_S = 2.5             # forget a track if not seen for this long
OCR_FIRST_FRAME_FALLBACK = 6      # OCR a track this many frames after first sight even without stability
OCR_STABLE_FRAMES = 2             # OCR a track this many stable frames before locking
OCR_RELOCK_AFTER_S = 25.0         # re-OCR a long-lived track every N seconds (handles plate change/clarity)
DEDUPE_WINDOW_S = 90              # within this window, same plate from same camera = 1 detection
MAX_RECENT_PLATES_CACHE = 256     # LRU bound on the dedupe cache
ENFORCEMENT_FINE_MAP = {
    "IMPOUND_RECOMMENDED": 10000,
    "CITATE_AND_FLAG": 5000,
    "ISSUE_CHALLAN": 2000,
    "ADVISE_ONLY": 0,
    "PASS": 0,
    "VERIFY_OWNER": 1500,
}


# ── Per-vehicle track state ──────────────────────────────────────────


@dataclass
class _Track:
    """Per-vehicle running state inside one camera."""
    track_id: int
    first_seen: float
    last_seen: float
    bbox: BoundingBox
    frames: int = 0
    stable_frames: int = 0
    ocr_done: bool = False
    last_ocr_at: float = 0.0
    locked_plate: Optional[str] = None
    locked_quality: float = 0.0

    def update(self, bbox: BoundingBox, now: float) -> None:
        prev = self.bbox
        iou = _iou(prev, bbox)
        self.bbox = bbox
        self.last_seen = now
        self.frames += 1
        # centroid drift used as stability heuristic — IoU is too coarse for plate-OCR gating
        cx_prev = (prev.x1 + prev.x2) // 2
        cy_prev = (prev.y1 + prev.y2) // 2
        cx_now = (bbox.x1 + bbox.x2) // 2
        cy_now = (bbox.y1 + bbox.y2) // 2
        drift = abs(cx_now - cx_prev) + abs(cy_now - cy_prev)
        if drift < 18:
            self.stable_frames += 1
        else:
            self.stable_frames = 0


def _iou(a: BoundingBox, b: BoundingBox) -> float:
    ix1, iy1 = max(a.x1, b.x1), max(a.y1, b.y1)
    ix2, iy2 = min(a.x2, b.x2), min(a.y2, b.y2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    if inter == 0:
        return 0.0
    union = a.area + b.area - inter
    return inter / union if union > 0 else 0.0


class _Tracker:
    """Very small IoU tracker. Good enough for short-lived demo tracks."""

    def __init__(self) -> None:
        self._tracks: dict[int, _Track] = {}
        self._next_id = 1

    def assign(self, detections: list[DetectionResult], now: float) -> list[tuple[_Track, DetectionResult]]:
        # Expire stale tracks
        for tid in [t for t, tr in self._tracks.items() if (now - tr.last_seen) > TRACK_TIMEOUT_S]:
            self._tracks.pop(tid, None)

        out: list[tuple[_Track, DetectionResult]] = []
        used: set[int] = set()
        for det in detections:
            best_tid: Optional[int] = None
            best_iou = TRACK_IOU_MATCH
            for tid, tr in self._tracks.items():
                if tid in used:
                    continue
                v = _iou(tr.bbox, det.bbox)
                if v > best_iou:
                    best_iou = v
                    best_tid = tid
            if best_tid is None:
                tr = _Track(
                    track_id=self._next_id,
                    first_seen=now,
                    last_seen=now,
                    bbox=det.bbox,
                    frames=1,
                )
                self._tracks[self._next_id] = tr
                self._next_id += 1
                out.append((tr, det))
            else:
                tr = self._tracks[best_tid]
                tr.update(det.bbox, now)
                used.add(best_tid)
                out.append((tr, det))
        return out

    def get(self, tid: int) -> Optional[_Track]:
        return self._tracks.get(tid)


# ── Per-camera pipeline diagnostics ───────────────────────────────────


@dataclass
class _PipelineStats:
    frames_processed: int = 0
    yolo_runs: int = 0
    vehicles_seen: int = 0
    ocr_attempts: int = 0
    ocr_reliable: int = 0
    detections_persisted: int = 0
    detections_deduped: int = 0
    challans_issued: int = 0
    evidence_saved: int = 0
    last_yolo_ms: float = 0.0
    last_ocr_ms: float = 0.0
    last_loop_ms: float = 0.0
    last_plate: Optional[str] = None
    last_plate_at: Optional[float] = None
    last_error: Optional[str] = None

    def as_dict(self) -> dict:
        return {
            **self.__dict__,
            "last_plate_age_s": (
                round(time.time() - self.last_plate_at, 1) if self.last_plate_at else None
            ),
        }


@dataclass
class _WorkerHandle:
    camera_id: str
    task: asyncio.Task
    source: StreamSource
    tracker: _Tracker
    stats: _PipelineStats
    recent_plates: "OrderedDict[str, float]"  # plate -> last_seen_ts


# ── Registry ──────────────────────────────────────────────────────────


class DemoPipelineRegistry:
    def __init__(self) -> None:
        self._workers: dict[str, _WorkerHandle] = {}
        self._lock = asyncio.Lock()

    async def start(self, camera_id: str, source_url: str | int) -> dict:
        async with self._lock:
            await self._stop_unlocked(camera_id)

            # stream_registry.register() is synchronous and may block up to
            # 4 seconds inside `thread.join()` when tearing down a previous
            # reader thread that's hung in `cv2.VideoCapture.read()` (which
            # is the common state when an IP webcam goes silent). Running it
            # in a worker thread keeps the asyncio event loop free — without
            # this offload the whole API freezes during reconnects, which
            # the operator perceives as "the website went offline."
            src = await asyncio.to_thread(
                stream_registry.register, camera_id, source_url, camera_id
            )
            opened = await asyncio.to_thread(src.wait_until_opened, 9.0)
            if not opened:
                await asyncio.to_thread(stream_registry.unregister, camera_id)
                logger.warning("demo_stream_open_timeout", camera_id=camera_id, source=str(source_url))
                return {
                    "status": "failed",
                    "reason": (
                        "Could not open stream within 9s. Check that the URL is reachable "
                        "from this machine (same Wi-Fi, correct port, /video path). "
                        "If running in Docker, the container must be able to reach the phone's LAN IP."
                    ),
                }

            handle = _WorkerHandle(
                camera_id=camera_id,
                task=asyncio.create_task(
                    _run_pipeline(camera_id, src),
                    name=f"demo-pipeline:{camera_id}",
                ),
                source=src,
                tracker=_Tracker(),
                stats=_PipelineStats(),
                recent_plates=OrderedDict(),
            )
            # Store handle BEFORE assigning task is fine — the task closure captures the camera_id
            # and looks up its handle by id at runtime.
            self._workers[camera_id] = handle
            logger.info(
                "demo_pipeline_started",
                camera_id=camera_id,
                source=str(source_url),
                detector_loaded=vehicle_detector.is_loaded,
                ocr_engines=plate_ocr.engines_loaded,
            )
            return {"status": "running", "source": str(source_url)}

    async def stop(self, camera_id: str) -> bool:
        async with self._lock:
            return await self._stop_unlocked(camera_id)

    async def _stop_unlocked(self, camera_id: str) -> bool:
        h = self._workers.pop(camera_id, None)
        if h is None:
            return False
        h.task.cancel()
        try:
            await h.task
        except (asyncio.CancelledError, Exception):
            pass
        # Same reason as in start(): unregister joins the reader thread for
        # up to 4 s when cv2.read() is hung. Offload to a worker thread so
        # the FastAPI loop stays alive during teardown.
        await asyncio.to_thread(stream_registry.unregister, camera_id)
        logger.info("demo_pipeline_stopped", camera_id=camera_id)
        return True

    async def stop_all(self) -> None:
        async with self._lock:
            for cid in list(self._workers.keys()):
                await self._stop_unlocked(cid)

    def status(self, camera_id: str) -> dict:
        h = self._workers.get(camera_id)
        src = stream_registry.get(camera_id)
        return {
            "camera_id": camera_id,
            "running": h is not None and not h.task.done(),
            "metrics": src.metrics.as_dict() if src else None,
        }

    def diagnostics(self, camera_id: str) -> dict:
        """Full pipeline state — surfaced on the /diagnostics endpoint."""
        h = self._workers.get(camera_id)
        src = stream_registry.get(camera_id)
        return {
            "camera_id": camera_id,
            "running": h is not None and not h.task.done(),
            "stream": {
                "open": src is not None and src.metrics.last_frame_at > 0,
                "metrics": src.metrics.as_dict() if src else None,
                "source": str(src.source) if src else None,
            },
            "models": {
                "yolo_loaded": vehicle_detector.is_loaded,
                "ocr_engines": plate_ocr.engines_loaded,
            },
            "pipeline": h.stats.as_dict() if h else None,
            "active_tracks": (
                [
                    {
                        "track_id": t.track_id,
                        "frames": t.frames,
                        "stable_frames": t.stable_frames,
                        "ocr_done": t.ocr_done,
                        "locked_plate": t.locked_plate,
                        "locked_quality": round(t.locked_quality, 3),
                        "age_s": round(time.time() - t.first_seen, 2),
                    }
                    for t in (h.tracker._tracks.values() if h else [])
                ]
                if h else []
            ),
            "recent_plates": (
                [
                    {"plate": p, "age_s": round(time.time() - ts, 1)}
                    for p, ts in (h.recent_plates.items() if h else [])
                ][-20:]
            ),
        }

    def _handle(self, camera_id: str) -> Optional[_WorkerHandle]:
        return self._workers.get(camera_id)


demo_pipelines = DemoPipelineRegistry()


# ── Core loop ────────────────────────────────────────────────────────


async def _run_pipeline(camera_id: str, source: StreamSource) -> None:
    """One async task per camera. Cancellable.

    Resilience contract:
      * Each iteration body is wrapped (inside `_pipeline_tick`) in a
        try/except so a single bad frame cannot kill the worker.
      * Consecutive `frame is None` polls beyond DEAD_STREAM_S broadcast
        a `stream_dead` event so the frontend flips to the recovery UI
        proactively rather than waiting for the WS to die.
    """
    period = 1.0 / LOOP_TARGET_FPS
    last_loop = time.perf_counter()
    state: dict = {
        "last_frame_seen_at": time.time(),
        "dead_stream_announced": False,
        "consecutive_errors": 0,
    }
    DEAD_STREAM_S = 6.0
    MAX_ITER_ERRORS = 25

    while True:
        await asyncio.sleep(max(0.0, period - (time.perf_counter() - last_loop)))
        last_loop = time.perf_counter()

        try:
            keep_going = await _pipeline_tick(camera_id, source, state, DEAD_STREAM_S)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            state["consecutive_errors"] += 1
            logger.error(
                "demo_pipeline_iter_failed",
                camera_id=camera_id,
                error=str(exc),
                consecutive=state["consecutive_errors"],
                exc_info=True,
            )
            handle = demo_pipelines._handle(camera_id)
            if handle is not None:
                handle.stats.last_error = f"iter: {exc}"
            if state["consecutive_errors"] >= MAX_ITER_ERRORS:
                logger.error(
                    "demo_pipeline_giving_up", camera_id=camera_id,
                    error=str(exc), max_errors=MAX_ITER_ERRORS,
                )
                # Surface to the frontend so the operator can decide what to do
                with contextlib.suppress(Exception):
                    await _broadcast(camera_id, {
                        "type": "stream_state",
                        "camera_id": camera_id,
                        "running": False,
                        "fatal_error": str(exc),
                    })
                return
            # Backoff a beat so we don't tight-loop on a broken iteration
            await asyncio.sleep(0.25)
            continue
        else:
            state["consecutive_errors"] = 0
            if not keep_going:
                return


async def _pipeline_tick(
    camera_id: str,
    source: StreamSource,
    state: dict,
    dead_stream_s: float,
) -> bool:
    """Run one iteration of the pipeline. Returns False if the worker should exit."""
    loop_start = time.perf_counter()

    handle = demo_pipelines._handle(camera_id)
    if handle is None:
        logger.warning("demo_pipeline_orphan_loop_exit", camera_id=camera_id)
        return False

    frame, age_ms = source.latest_frame_with_age_ms()
    if frame is None:
        stale_s = time.time() - state["last_frame_seen_at"]
        if stale_s > dead_stream_s and not state["dead_stream_announced"]:
            logger.warning(
                "demo_pipeline_stream_dead",
                camera_id=camera_id, stale_s=round(stale_s, 1),
            )
            await _broadcast(camera_id, {
                "type": "stream_state",
                "camera_id": camera_id,
                "running": True,
                "stream_dead": True,
                "stale_s": round(stale_s, 1),
                "telemetry": source.metrics.as_dict(),
            })
            state["dead_stream_announced"] = True
        await _broadcast_heartbeat(camera_id, source, handle.stats)
        return True

    state["last_frame_seen_at"] = time.time()
    if state["dead_stream_announced"]:
        logger.info("demo_pipeline_stream_recovered", camera_id=camera_id)
        state["dead_stream_announced"] = False
        # Tell the frontend the stream is alive again
        with contextlib.suppress(Exception):
            await _broadcast(camera_id, {
                "type": "stream_state",
                "camera_id": camera_id,
                "running": True,
                "stream_dead": False,
                "telemetry": source.metrics.as_dict(),
            })

    handle.stats.frames_processed += 1

    # ── YOLO every frame ─────────────────────────────────────
    t_yolo = time.perf_counter()
    try:
        detections: list[DetectionResult] = await asyncio.to_thread(
            vehicle_detector.detect, frame
        )
        handle.stats.yolo_runs += 1
    except Exception as exc:
        handle.stats.last_error = f"yolo: {exc}"
        logger.error("demo_yolo_failed", camera_id=camera_id, error=str(exc))
        detections = []
    handle.stats.last_yolo_ms = round((time.perf_counter() - t_yolo) * 1000, 1)

    height, width = frame.shape[:2]
    now = time.time()

    # ── Per-vehicle tracking ─────────────────────────────────
    pairs = handle.tracker.assign(detections, now)
    if detections:
        handle.stats.vehicles_seen = max(handle.stats.vehicles_seen, len(handle.tracker._tracks))

    # ── OCR gating: pick at most one track to OCR this frame ─
    track_to_ocr: Optional[tuple[_Track, DetectionResult]] = None
    for track, det in pairs:
        if track.ocr_done and (now - track.last_ocr_at) < OCR_RELOCK_AFTER_S:
            continue  # already locked recently
        stable_enough = track.stable_frames >= OCR_STABLE_FRAMES
        old_enough = track.frames >= OCR_FIRST_FRAME_FALLBACK
        if not (stable_enough or old_enough):
            continue
        # Pick the largest pending track this frame
        if track_to_ocr is None or det.bbox.area > track_to_ocr[1].bbox.area:
            track_to_ocr = (track, det)

    ocr_text: Optional[str] = None
    ocr_conf: float = 0.0
    ocr_engine: Optional[str] = None
    ocr_quality: float = 0.0
    ocr_reliable: bool = False
    plate_crop: Optional[np.ndarray] = None

    if track_to_ocr is not None:
        track, det = track_to_ocr
        t_ocr = time.perf_counter()
        try:
            ocr_text, ocr_conf, ocr_engine, ocr_quality, ocr_reliable, plate_crop = (
                await _ocr_on_detection(frame, det)
            )
        except Exception as exc:
            handle.stats.last_error = f"ocr: {exc}"
            logger.error("demo_ocr_failed", camera_id=camera_id, error=str(exc))
            ocr_text, ocr_conf, ocr_engine, ocr_quality, ocr_reliable, plate_crop = (
                None, 0.0, None, 0.0, False, None
            )
        handle.stats.last_ocr_ms = round((time.perf_counter() - t_ocr) * 1000, 1)
        handle.stats.ocr_attempts += 1
        track.last_ocr_at = now

        logger.info(
            "demo_ocr_attempt",
            camera_id=camera_id,
            track_id=track.track_id,
            text=ocr_text,
            confidence=round(ocr_conf, 3),
            quality=round(ocr_quality, 3),
            engine=ocr_engine,
            reliable=ocr_reliable,
        )

        # Broadcast EVERY attempt so the operator sees the AI working
        with contextlib.suppress(Exception):
            await _broadcast(camera_id, {
                "type": "ocr_attempt",
                "camera_id": camera_id,
                "track_id": track.track_id,
                "text": ocr_text or None,
                "confidence": round(ocr_conf, 3) if ocr_conf else 0.0,
                "quality_score": round(ocr_quality, 3) if ocr_quality else 0.0,
                "engine": ocr_engine,
                "reliable": ocr_reliable,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        if ocr_reliable and ocr_text:
            handle.stats.ocr_reliable += 1
            track.ocr_done = True
            track.locked_plate = ocr_text
            track.locked_quality = ocr_quality

    # ── Compliance + persistence (only when we have a reliable plate) ──
    compliance: Optional[ComplianceReport] = None
    detection_id: Optional[uuid.UUID] = None
    is_duplicate = False

    if ocr_reliable and ocr_text:
        # Dedupe window
        last_emit = handle.recent_plates.get(ocr_text)
        if last_emit is not None and (now - last_emit) < DEDUPE_WINDOW_S:
            is_duplicate = True
            handle.stats.detections_deduped += 1
            logger.info(
                "demo_detection_deduped",
                camera_id=camera_id,
                plate=ocr_text,
                age_s=round(now - last_emit, 1),
            )

        # Always evaluate compliance for the live overlay even if dedupe-suppressed
        try:
            compliance = await assess_compliance(ocr_text)
        except Exception as exc:
            handle.stats.last_error = f"compliance: {exc}"
            logger.error("demo_compliance_failed", camera_id=camera_id, error=str(exc), plate=ocr_text)
            compliance = None

        if not is_duplicate and compliance is not None:
            try:
                detection_id = await _persist_detection(
                    camera_id_str=camera_id,
                    frame_w=width,
                    frame_h=height,
                    dominant=track_to_ocr[1],
                    plate=ocr_text,
                    ocr_conf=ocr_conf,
                    plate_conf=track_to_ocr[1].plate_confidence,
                    compliance=compliance,
                    processing_ms=int(handle.stats.last_yolo_ms + handle.stats.last_ocr_ms),
                )
            except Exception as exc:
                handle.stats.last_error = f"persist: {exc}"
                logger.error("demo_persist_failed", camera_id=camera_id, error=str(exc), plate=ocr_text)
                detection_id = None
            if detection_id is not None:
                handle.stats.detections_persisted += 1
                handle.stats.last_plate = ocr_text
                handle.stats.last_plate_at = now
                _remember(handle.recent_plates, ocr_text, now)

                # Fire-and-forget evidence save (does not block the loop)
                asyncio.create_task(_save_evidence(
                    camera_id=camera_id,
                    detection_id=str(detection_id),
                    frame=frame.copy(),  # copy — the buffer is shared
                    plate_crop=plate_crop,
                    plate_text=ocr_text,
                    detections=detections,
                    stats=handle.stats,
                ))

    # ── Broadcast frame payload ──────────────────────────────
    loop_ms = (time.perf_counter() - loop_start) * 1000.0
    handle.stats.last_loop_ms = round(loop_ms, 1)

    payload = _build_payload(
        camera_id=camera_id,
        source=source,
        frame_w=width,
        frame_h=height,
        detections=detections,
        tracks=pairs,
        ocr_text=ocr_text if ocr_reliable else None,
        ocr_conf=ocr_conf if ocr_reliable else 0.0,
        plate_conf=(track_to_ocr[1].plate_confidence if track_to_ocr else 0.0),
        compliance=compliance,
        processing_ms=loop_ms,
        stream_age_ms=age_ms,
        detection_id=str(detection_id) if detection_id else None,
        is_duplicate=is_duplicate,
        stats=handle.stats,
    )
    with contextlib.suppress(Exception):
        await _broadcast(camera_id, payload)
    return True


# ── Helpers ───────────────────────────────────────────────────────────


def _remember(cache: "OrderedDict[str, float]", plate: str, ts: float) -> None:
    cache[plate] = ts
    cache.move_to_end(plate)
    while len(cache) > MAX_RECENT_PLATES_CACHE:
        cache.popitem(last=False)


async def _ocr_on_detection(
    frame: np.ndarray, det: DetectionResult
) -> tuple[Optional[str], float, Optional[str], float, bool, Optional[np.ndarray]]:
    """OCR the plate region of `det`. Returns
    (text, confidence, engine, quality_score, is_reliable, plate_crop_used)."""
    h, w = frame.shape[:2]

    # Pick the most plate-likely crop: dedicated plate_bbox > positional > whole vehicle
    if det.plate_bbox is not None:
        bx = det.plate_bbox
    else:
        # Positional heuristic on the vehicle bbox — plates sit lower-centre
        vw, vh = det.bbox.x2 - det.bbox.x1, det.bbox.y2 - det.bbox.y1
        if vw < 40 or vh < 30:
            bx = det.bbox  # tiny vehicle, just try the whole thing
        else:
            bx = BoundingBox(
                x1=det.bbox.x1 + int(vw * 0.18),
                y1=det.bbox.y1 + int(vh * 0.55),
                x2=det.bbox.x1 + int(vw * 0.82),
                y2=det.bbox.y1 + int(vh * 0.95),
            )

    x1 = max(0, min(w - 1, bx.x1))
    y1 = max(0, min(h - 1, bx.y1))
    x2 = max(0, min(w, bx.x2))
    y2 = max(0, min(h, bx.y2))
    crop = frame[y1:y2, x1:x2]
    if crop.size == 0:
        return None, 0.0, None, 0.0, False, None

    try:
        prepped = await asyncio.to_thread(preprocess_plate_crop, crop)
        result = await asyncio.to_thread(plate_ocr.read_plate, prepped)
    except Exception as exc:
        logger.error("demo_ocr_exception", error=str(exc))
        return None, 0.0, None, 0.0, False, crop

    return (
        result.text or None,
        float(result.confidence or 0.0),
        result.engine_used,
        float(result.quality_score or 0.0),
        bool(result.is_reliable),
        crop,
    )


def _build_payload(
    *,
    camera_id: str,
    source: StreamSource,
    frame_w: int,
    frame_h: int,
    detections: list[DetectionResult],
    tracks: list[tuple[_Track, DetectionResult]],
    ocr_text: Optional[str],
    ocr_conf: float,
    plate_conf: float,
    compliance: Optional[ComplianceReport],
    processing_ms: float,
    stream_age_ms: float,
    detection_id: Optional[str],
    is_duplicate: bool,
    stats: _PipelineStats,
) -> dict:
    metrics = source.metrics.as_dict()
    track_by_det = {id(det): tr for tr, det in tracks}
    return {
        "type": "stream_frame",
        "camera_id": camera_id,
        "status": metrics.get("stream_health", "UNKNOWN"),
        "frame_dimensions": {"width": frame_w, "height": frame_h},
        "telemetry": {
            **metrics,
            "pipeline_ms": round(processing_ms, 1),
            "frame_age_ms": round(stream_age_ms, 1),
            "yolo_ms": stats.last_yolo_ms,
            "ocr_ms": stats.last_ocr_ms,
            "frames_processed": stats.frames_processed,
            "ocr_attempts": stats.ocr_attempts,
            "ocr_reliable": stats.ocr_reliable,
            "detections_persisted": stats.detections_persisted,
            "active_tracks": len(tracks),
        },
        "detections": [
            {
                "bbox": [d.bbox.x1, d.bbox.y1, d.bbox.x2, d.bbox.y2],
                "confidence": round(d.confidence, 3),
                "class_name": d.class_name,
                "plate_bbox": (
                    [d.plate_bbox.x1, d.plate_bbox.y1, d.plate_bbox.x2, d.plate_bbox.y2]
                    if d.plate_bbox else None
                ),
                "plate_confidence": round(d.plate_confidence, 3) if d.plate_confidence else None,
                "track_id": track_by_det.get(id(d)).track_id if track_by_det.get(id(d)) else None,
                "locked_plate": (
                    track_by_det.get(id(d)).locked_plate if track_by_det.get(id(d)) else None
                ),
            }
            for d in detections
        ],
        "plate_read": ({
            "id": detection_id,
            "plate_text": ocr_text,
            "ocr_confidence": round(ocr_conf, 3) if ocr_conf else None,
            "plate_confidence": round(plate_conf, 3) if plate_conf else None,
            "is_duplicate": is_duplicate,
            "compliance": compliance.as_dict() if compliance else None,
        } if ocr_text else None),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def _broadcast_heartbeat(camera_id: str, source: StreamSource, stats: _PipelineStats) -> None:
    await _broadcast(camera_id, {
        "type": "heartbeat",
        "camera_id": camera_id,
        "status": source.metrics.health,
        "telemetry": {
            **source.metrics.as_dict(),
            "frames_processed": stats.frames_processed,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


async def _broadcast(camera_id: str, payload: dict) -> None:
    await ws_manager.broadcast_to_room(f"demo:{camera_id}", payload)
    # Mirror plate reads onto the global feeds so the surveillance wall sees them too
    if payload.get("type") == "stream_frame" and payload.get("plate_read"):
        pr = payload["plate_read"]
        if pr.get("is_duplicate"):
            return
        compliance = pr.get("compliance") or {}
        violation = compliance.get("risk_score", 0) >= 30
        global_payload = {
            "type": "detection",
            "id": pr.get("id") or str(uuid.uuid4()),
            "camera_id": camera_id,
            "camera_code": "LIVE",
            "camera_name": "Live mobile camera",
            "camera_location": "Demo source",
            "plate": pr["plate_text"],
            "ocr_confidence": pr.get("ocr_confidence"),
            "vehicle_confidence": (payload["detections"][0]["confidence"] if payload["detections"] else None),
            "plate_confidence": pr.get("plate_confidence"),
            "is_violation": violation,
            "violation_type": _violation_label(compliance),
            "processing_time_ms": int(payload["telemetry"].get("pipeline_ms") or 0),
            "bounding_box": (
                _bbox_dict(payload["detections"][0]["bbox"]) if payload["detections"] else None
            ),
            "frame_width": payload["frame_dimensions"]["width"],
            "frame_height": payload["frame_dimensions"]["height"],
            "timestamp": payload["timestamp"],
        }
        await ws_manager.broadcast_to_room("global:detections", global_payload)
        if violation:
            await ws_manager.broadcast_to_room("global:alerts", global_payload)


def _bbox_dict(arr: list[int]) -> dict:
    return {"x1": arr[0], "y1": arr[1], "x2": arr[2], "y2": arr[3]}


def _violation_label(compliance: dict) -> Optional[str]:
    if compliance.get("blacklist", {}).get("status") == "FLAGGED":
        return "Blacklisted Vehicle"
    for key, label in (
        ("registration", "Expired Registration"),
        ("insurance", "Expired Insurance"),
        ("puc", "Expired Pollution Cert"),
    ):
        if compliance.get(key, {}).get("status") == "EXPIRED":
            return label
    if compliance.get("open_violations", 0) > 0:
        return "Outstanding Fines"
    return None


# ── Persistence + evidence ───────────────────────────────────────────


async def _persist_detection(
    *,
    camera_id_str: str,
    frame_w: int,
    frame_h: int,
    dominant: Optional[DetectionResult],
    plate: str,
    ocr_conf: float,
    plate_conf: float,
    compliance: ComplianceReport,
    processing_ms: int,
) -> Optional[uuid.UUID]:
    async with AsyncSessionFactory() as session:
        # Resolve camera string ID → UUID (e.g. "demo-primary" → DB UUID)
        cam_uuid: Optional[uuid.UUID] = None
        try:
            row = await session.execute(select(Camera.id).where(Camera.camera_id == camera_id_str))
            cam_uuid = row.scalar_one_or_none()
        except Exception:
            cam_uuid = None

        veh_id: Optional[uuid.UUID] = None
        if compliance.vehicle_known:
            v = await session.execute(select(Vehicle.id).where(Vehicle.plate_number == plate))
            v_id = v.scalar_one_or_none()
            if v_id:
                veh_id = v_id

        bbox_json = None
        plate_bbox_json = None
        if dominant:
            bbox_json = {
                "x1": dominant.bbox.x1, "y1": dominant.bbox.y1,
                "x2": dominant.bbox.x2, "y2": dominant.bbox.y2,
            }
            if dominant.plate_bbox:
                plate_bbox_json = {
                    "x1": dominant.plate_bbox.x1, "y1": dominant.plate_bbox.y1,
                    "x2": dominant.plate_bbox.x2, "y2": dominant.plate_bbox.y2,
                }

        violation_label = _violation_label(compliance.as_dict())
        if not compliance.vehicle_known:
            violation_label = "Unregistered Vehicle"

        det = Detection(
            camera_id=cam_uuid,
            vehicle_id=veh_id,
            detected_plate=plate,
            ocr_confidence=ocr_conf,
            ocr_raw_text=plate,
            vehicle_confidence=dominant.confidence if dominant else None,
            plate_confidence=plate_conf or None,
            vehicle_category=dominant.class_name if dominant else None,
            bounding_box=bbox_json,
            plate_bounding_box=plate_bbox_json,
            timestamp=datetime.utcnow(),
            status=DetectionStatus.PROCESSED,
            is_violation=bool(violation_label),
            violation_type=violation_label,
            processing_time_ms=processing_ms,
        )
        session.add(det)
        await session.flush()
        await session.refresh(det)

        if compliance.risk_score >= 55:
            # Issue a challan. Three paths:
            #   1. Known DB vehicle  → use real owner record.
            #   2. Synthetic dossier → use the AI-generated owner (still
            #      believable, tagged as synthetic via violation_description).
            #   3. Plate failed to resolve  → sentinel name + log warning.
            is_synthetic = getattr(compliance, "is_synthetic", False)
            is_unregistered = not compliance.vehicle_known or veh_id is None
            fine = ENFORCEMENT_FINE_MAP.get(compliance.enforcement_action, 2000)

            if is_unregistered and is_synthetic and compliance.owner.name:
                # Synthetic dossier path — owner fields are populated by
                # the generator and read as a real Indian record.
                challan_violation_type = violation_label or "Compliance violation"
                owner_name_final = compliance.owner.name
                owner_phone_final = compliance.owner.phone
                owner_email_final = compliance.owner.email
            elif is_unregistered:
                # Last-resort fallback (shouldn't happen now that
                # assess_compliance always returns synthetic for unknown
                # plates, but kept defensive in case the synthetic engine
                # itself errors).
                fine = FINE_AMOUNTS.get("unregistered_vehicle", fine)
                challan_violation_type = "Unregistered Vehicle"
                owner_name_final = "Unknown Owner (Registry Out-of-Sync)"
                owner_phone_final: Optional[str] = None
                owner_email_final: Optional[str] = None
            else:
                challan_violation_type = violation_label or "Compliance violation"
                owner_name_final = compliance.owner.name
                owner_phone_final = compliance.owner.phone
                owner_email_final = compliance.owner.email

            # OCR safety gate — never auto-issue a challan from a borderline
            # OCR read. The pipeline already requires `ocr_reliable` to even
            # call us, but this is a defense-in-depth check: real govt
            # systems require ≥0.80 OCR confidence before any auto-action.
            CHALLAN_OCR_CONFIDENCE_THRESHOLD = 0.80
            if (ocr_conf or 0) < CHALLAN_OCR_CONFIDENCE_THRESHOLD:
                logger.warning(
                    "demo_challan_suppressed_low_ocr",
                    plate=plate,
                    ocr_confidence=round(ocr_conf, 3),
                    threshold=CHALLAN_OCR_CONFIDENCE_THRESHOLD,
                    risk=compliance.risk_score,
                    detection_id=str(det.id),
                )
                # Mark detection for manual review instead of issuing.
                det.violation_type = (
                    (det.violation_type or "Manual review") + " — manual review required"
                )
                await session.commit()
                return det.id

            cn = f"CHN-{datetime.utcnow().strftime('%y%m')}-{uuid.uuid4().hex[:6].upper()}"
            desc_suffix = " · synthetic intel" if is_synthetic else ""
            ch = Challan(
                challan_number=cn,
                vehicle_id=veh_id,
                detection_id=det.id,
                violation_type=challan_violation_type,
                violation_description=(
                    f"AI auto-issued ({compliance.enforcement_action}, "
                    f"risk {compliance.risk_score}/100){desc_suffix}"
                ),
                plate_number=plate,
                fine_amount=fine,
                status=ChallanStatus.ISSUED,
                issued_at=datetime.now(timezone.utc),
                owner_name=owner_name_final,
                owner_phone=owner_phone_final,
                owner_email=owner_email_final,
            )
            session.add(ch)
            logger.info(
                "demo_challan_auto_issued",
                challan_number=cn,
                plate=plate,
                fine=fine,
                risk=compliance.risk_score,
            )
            if is_unregistered:
                # Surface separately so registry-sync dashboards can count
                # these without parsing violation_type strings.
                logger.warning(
                    "demo_challan_unregistered_vehicle",
                    challan_number=cn,
                    plate=plate,
                    fine=fine,
                    risk=compliance.risk_score,
                )

        await session.commit()
        return det.id


async def _save_evidence(
    *,
    camera_id: str,
    detection_id: str,
    frame: np.ndarray,
    plate_crop: Optional[np.ndarray],
    plate_text: str,
    detections: list[DetectionResult],
    stats: _PipelineStats,
) -> None:
    """Persist annotated frame + plate crop. Updates the Detection row with paths."""
    try:
        frame_path, crop_path = await asyncio.gather(
            save_frame_async(frame, camera_id, detection_id, detections),
            save_plate_crop_async(plate_crop, camera_id, detection_id, plate_text)
                if plate_crop is not None else _noop(),
        )
        # Update DB with paths
        try:
            det_uuid = uuid.UUID(detection_id)
            async with AsyncSessionFactory() as session:
                det = await session.get(Detection, det_uuid)
                if det is not None:
                    if frame_path:
                        det.frame_path = frame_path
                    if crop_path:
                        det.plate_crop_path = crop_path
                    await session.commit()
        except Exception as exc:
            logger.warning("evidence_path_update_failed", error=str(exc), detection_id=detection_id)

        if frame_path or crop_path:
            stats.evidence_saved += 1
        logger.info(
            "demo_evidence_saved",
            camera_id=camera_id,
            detection_id=detection_id,
            plate=plate_text,
            frame_path=frame_path,
            crop_path=crop_path,
        )

        # Broadcast a dedicated evidence event so the UI can preview the snapshot
        await _broadcast(camera_id, {
            "type": "evidence_saved",
            "camera_id": camera_id,
            "detection_id": detection_id,
            "plate": plate_text,
            "frame_path": frame_path,
            "plate_crop_path": crop_path,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        logger.error("demo_evidence_save_failed", camera_id=camera_id, error=str(exc))


async def _noop() -> None:
    return None
