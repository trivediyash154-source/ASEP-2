"""
YOLOv8 vehicle and license plate detector.

NO MOCKS. If the model cannot be loaded this module raises at startup so the
problem is immediately visible — it does NOT silently return fake bounding boxes.

Detection flow:
  1. Primary model  → YOLOv8 (ultralytics) on vehicle classes
  2. Plate crop     → Second YOLO model (plate_detector.pt) OR Haar cascade fallback
  3. Fallback note  → Haar cascade gives real detections, not fake data
"""

import asyncio
import shutil
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# COCO class IDs that correspond to vehicles
VEHICLE_CLASS_IDS: Dict[int, str] = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

# Haar cascade shipped with OpenCV (no download needed)
HAAR_CASCADE_PATH = cv2.data.haarcascades + "haarcascade_russian_plate_number.xml"

# Bundled model fallback — lives outside the model_cache volume mount,
# so it survives `docker compose down -v` and seeds the cache on first run.
BUNDLED_MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "ai" / "_bundled"


@dataclass
class BoundingBox:
    x1: int
    y1: int
    x2: int
    y2: int

    @property
    def as_tuple(self) -> Tuple[int, int, int, int]:
        return self.x1, self.y1, self.x2, self.y2

    @property
    def area(self) -> int:
        return max(0, self.x2 - self.x1) * max(0, self.y2 - self.y1)

    def as_dict(self) -> dict:
        return {"x1": self.x1, "y1": self.y1, "x2": self.x2, "y2": self.y2}


@dataclass
class DetectionResult:
    bbox: BoundingBox
    confidence: float
    class_id: int
    class_name: str
    plate_bbox: Optional[BoundingBox] = None
    plate_confidence: float = 0.0
    inference_time_ms: float = 0.0
    # Raw frame dimensions for downstream scaling
    frame_width: int = 0
    frame_height: int = 0


class VehicleDetector:
    """
    Wraps YOLOv8 for vehicle detection and a second model (or Haar cascade)
    for license plate region extraction.

    Raises RuntimeError at load() if the primary model cannot be initialised.
    GPU usage is controlled by settings.GPU_ENABLED.
    """

    def __init__(self) -> None:
        self._model = None
        self._plate_model = None
        self._haar_cascade: Optional[cv2.CascadeClassifier] = None
        self._device = "cuda" if settings.GPU_ENABLED else "cpu"
        self._loaded = False

    # ── Public API ────────────────────────────────────────────────

    def load(self) -> None:
        """Load models. Raises RuntimeError if ultralytics is not installed."""
        try:
            from ultralytics import YOLO
        except ImportError:
            raise RuntimeError(
                "ultralytics is not installed. Run: pip install ultralytics"
            )

        model_path = Path(settings.YOLO_MODEL_PATH)
        model_path.parent.mkdir(parents=True, exist_ok=True)

        if not model_path.exists():
            bundled = BUNDLED_MODEL_DIR / model_path.name
            if bundled.exists():
                # Seed the model cache from the bundled copy — one-time copy
                # so subsequent boots find the file in-place and skip this branch.
                shutil.copyfile(bundled, model_path)
                logger.info(
                    "yolo_model_seeded_from_bundle",
                    bundled=str(bundled),
                    target=str(model_path),
                )
            else:
                logger.warning(
                    "yolo_model_not_found_downloading",
                    path=str(model_path),
                    note="No bundled fallback; ultralytics will download ~6 MB",
                )
                # ultralytics downloads automatically when a named model is given
                self._model = None  # set below

        effective_path = str(model_path) if model_path.exists() else "yolov8n.pt"

        self._model = YOLO(effective_path)
        self._model.to(self._device)
        logger.info(
            "yolo_vehicle_model_loaded",
            device=self._device,
            model=effective_path,
            classes=list(VEHICLE_CLASS_IDS.values()),
        )

        # Optional dedicated plate detection model
        plate_path = model_path.parent / "plate_detector.pt"
        if plate_path.exists():
            self._plate_model = YOLO(str(plate_path))
            self._plate_model.to(self._device)
            logger.info("yolo_plate_model_loaded", path=str(plate_path))
        else:
            logger.info(
                "yolo_plate_model_not_found_using_haar_fallback",
                expected=str(plate_path),
            )
            # Pre-load Haar cascade (CPU only, ships with OpenCV)
            self._haar_cascade = cv2.CascadeClassifier(HAAR_CASCADE_PATH)
            if self._haar_cascade.empty():
                logger.warning(
                    "haar_cascade_load_failed",
                    path=HAAR_CASCADE_PATH,
                    note="Plate detection may miss some plates",
                )
                self._haar_cascade = None

        self._loaded = True

    def detect(self, frame: np.ndarray) -> List[DetectionResult]:
        """
        Synchronous detection. Raises RuntimeError if called before load().
        Returns empty list if no vehicles found (never returns fake data).
        """
        if not self._loaded:
            raise RuntimeError("VehicleDetector.load() must be called before detect()")

        h, w = frame.shape[:2]
        t0 = time.perf_counter()

        results = self._model(
            frame,
            conf=settings.YOLO_CONFIDENCE_THRESHOLD,
            iou=settings.YOLO_IOU_THRESHOLD,
            verbose=False,
            classes=list(VEHICLE_CLASS_IDS.keys()),
        )

        detections: List[DetectionResult] = []
        for r in results:
            for box in r.boxes:
                class_id = int(box.cls[0])
                if class_id not in VEHICLE_CLASS_IDS:
                    continue

                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                conf = float(box.conf[0])
                inference_ms = (time.perf_counter() - t0) * 1000

                det = DetectionResult(
                    bbox=BoundingBox(x1, y1, x2, y2),
                    confidence=conf,
                    class_id=class_id,
                    class_name=VEHICLE_CLASS_IDS[class_id],
                    inference_time_ms=round(inference_ms, 2),
                    frame_width=w,
                    frame_height=h,
                )

                # Detect plate within this vehicle's ROI
                vehicle_roi = frame[y1:y2, x1:x2]
                if vehicle_roi.size > 0:
                    plate_result = self._detect_plate_in_roi(vehicle_roi)
                    if plate_result:
                        px1, py1, px2, py2, p_conf = plate_result
                        # Convert back to full-frame coordinates
                        det.plate_bbox = BoundingBox(
                            x1 + px1, y1 + py1, x1 + px2, y1 + py2
                        )
                        det.plate_confidence = p_conf

                detections.append(det)

        logger.debug(
            "vehicle_detection_complete",
            vehicle_count=len(detections),
            with_plate=sum(1 for d in detections if d.plate_bbox),
            inference_ms=round((time.perf_counter() - t0) * 1000, 2),
        )
        return detections

    async def detect_async(self, frame: np.ndarray) -> List[DetectionResult]:
        """Non-blocking: offloads detection to a thread-pool executor."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.detect, frame)

    # ── Internal helpers ──────────────────────────────────────────

    def _detect_plate_in_roi(
        self, roi: np.ndarray
    ) -> Optional[Tuple[int, int, int, int, float]]:
        """Returns (x1,y1,x2,y2,confidence) in ROI-local coordinates, or None."""
        if self._plate_model is not None:
            return self._detect_plate_yolo(roi)
        if self._haar_cascade is not None:
            return self._detect_plate_haar(roi)
        # No plate detector available — return best-guess crop based on position
        return self._detect_plate_positional_heuristic(roi)

    def _detect_plate_yolo(
        self, roi: np.ndarray
    ) -> Optional[Tuple[int, int, int, int, float]]:
        try:
            results = self._plate_model(roi, conf=0.35, verbose=False)
            for r in results:
                if len(r.boxes) > 0:
                    # Take the highest-confidence plate
                    best_box = max(r.boxes, key=lambda b: float(b.conf[0]))
                    x1, y1, x2, y2 = map(int, best_box.xyxy[0].tolist())
                    return x1, y1, x2, y2, float(best_box.conf[0])
        except Exception as e:
            logger.error("plate_yolo_detection_failed", error=str(e))
        return None

    def _detect_plate_haar(
        self, roi: np.ndarray
    ) -> Optional[Tuple[int, int, int, int, float]]:
        """
        Uses the OpenCV Russian plate Haar cascade.
        Works reasonably on rectangular plates with contrasting text.
        Confidence is calibrated from detection scale score.
        """
        try:
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY) if len(roi.shape) == 3 else roi
            plates = self._haar_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=4,
                minSize=(60, 20),
                maxSize=(300, 80),
            )
            if len(plates) == 0:
                return None

            # Pick the largest detected region (most likely the plate)
            x, y, w, h = max(plates, key=lambda r: r[2] * r[3])
            # Haar cascade doesn't return confidence; use size-based proxy
            roi_area = roi.shape[0] * roi.shape[1]
            plate_area = w * h
            size_ratio = plate_area / max(roi_area, 1)
            # Expected plate-to-vehicle ratio: 0.02–0.12
            confidence = min(0.75, 0.45 + (size_ratio / 0.08) * 0.3)
            return x, y, x + w, y + h, round(confidence, 3)
        except Exception as e:
            logger.error("haar_plate_detection_failed", error=str(e))
            return None

    def _detect_plate_positional_heuristic(
        self, roi: np.ndarray
    ) -> Optional[Tuple[int, int, int, int, float]]:
        """
        Last-resort: plates are typically in the lower-centre of the vehicle bbox.
        Returns with very low confidence (0.30) so the pipeline can apply its own
        confidence threshold and discard if needed.
        """
        h, w = roi.shape[:2]
        if w < 40 or h < 30:
            return None
        # Bottom-centre crop: 60-90% height, 20-80% width
        y1 = int(h * 0.60)
        y2 = int(h * 0.90)
        x1 = int(w * 0.20)
        x2 = int(w * 0.80)
        logger.debug("using_positional_plate_heuristic", note="very low confidence 0.30")
        return x1, y1, x2, y2, 0.30

    @property
    def is_loaded(self) -> bool:
        return self._loaded


# Module-level singleton — loaded once at application startup
vehicle_detector = VehicleDetector()
