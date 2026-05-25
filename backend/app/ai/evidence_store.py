"""
Evidence snapshot storage.

Saves annotated full frames and cropped plate images to disk.
File layout:
  {UPLOAD_DIR}/evidence/YYYY/MM/DD/{camera_id}/{detection_id}_frame.jpg
  {UPLOAD_DIR}/evidence/YYYY/MM/DD/{camera_id}/{detection_id}_plate.jpg

All paths stored in the database are relative to UPLOAD_DIR so the
physical storage root can be moved without DB migrations.
"""

import asyncio
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Tuple

import cv2
import numpy as np

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Quality settings for JPEG evidence files
FRAME_JPEG_QUALITY = 85   # Balance quality vs storage
PLATE_JPEG_QUALITY = 95   # Higher quality for OCR audit trail


def _get_evidence_dir(camera_id: str, dt: Optional[datetime] = None) -> Path:
    """Returns the absolute directory path for evidence from this camera on dt."""
    if dt is None:
        dt = datetime.now(timezone.utc)
    return (
        Path(settings.UPLOAD_DIR)
        / "evidence"
        / dt.strftime("%Y")
        / dt.strftime("%m")
        / dt.strftime("%d")
        / camera_id
    )


def _relative_path(absolute: Path) -> str:
    """Returns path relative to UPLOAD_DIR for DB storage."""
    return str(absolute.relative_to(Path(settings.UPLOAD_DIR)))


def save_frame(
    frame: np.ndarray,
    camera_id: str,
    detection_id: str,
    detections: list,        # List of DetectionResult — draw bounding boxes
    dt: Optional[datetime] = None,
) -> Optional[str]:
    """
    Saves an annotated full frame with bounding boxes drawn.
    Returns the relative path (relative to UPLOAD_DIR) on success, None on failure.
    """
    try:
        dt = dt or datetime.now(timezone.utc)
        out_dir = _get_evidence_dir(camera_id, dt)
        out_dir.mkdir(parents=True, exist_ok=True)

        annotated = frame.copy()
        annotated = _draw_detections(annotated, detections)

        file_path = out_dir / f"{detection_id}_frame.jpg"
        success = cv2.imwrite(
            str(file_path),
            annotated,
            [cv2.IMWRITE_JPEG_QUALITY, FRAME_JPEG_QUALITY],
        )

        if not success:
            logger.error("frame_save_failed", path=str(file_path))
            return None

        rel = _relative_path(file_path)
        logger.debug("frame_saved", path=rel, size_kb=file_path.stat().st_size // 1024)
        return rel

    except Exception as e:
        logger.error("frame_save_exception", error=str(e), camera_id=camera_id)
        return None


def save_plate_crop(
    plate_crop: np.ndarray,
    camera_id: str,
    detection_id: str,
    plate_text: Optional[str] = None,
    dt: Optional[datetime] = None,
) -> Optional[str]:
    """
    Saves the raw (pre-processed) plate crop.
    Optionally overlays the OCR result text on the image for audit review.
    Returns the relative path on success, None on failure.
    """
    try:
        dt = dt or datetime.now(timezone.utc)
        out_dir = _get_evidence_dir(camera_id, dt)
        out_dir.mkdir(parents=True, exist_ok=True)

        annotated = plate_crop.copy()

        # Add OCR result overlay for human audit
        if plate_text:
            font_scale = max(0.5, plate_crop.shape[0] / 60)
            cv2.putText(
                annotated,
                plate_text,
                (4, max(20, int(plate_crop.shape[0] * 0.85))),
                cv2.FONT_HERSHEY_SIMPLEX,
                font_scale,
                (0, 255, 0),
                2,
                cv2.LINE_AA,
            )

        file_path = out_dir / f"{detection_id}_plate.jpg"
        success = cv2.imwrite(
            str(file_path),
            annotated,
            [cv2.IMWRITE_JPEG_QUALITY, PLATE_JPEG_QUALITY],
        )

        if not success:
            logger.error("plate_crop_save_failed", path=str(file_path))
            return None

        rel = _relative_path(file_path)
        logger.debug("plate_crop_saved", path=rel, plate=plate_text)
        return rel

    except Exception as e:
        logger.error("plate_crop_save_exception", error=str(e))
        return None


async def save_frame_async(
    frame: np.ndarray,
    camera_id: str,
    detection_id: str,
    detections: list,
    dt: Optional[datetime] = None,
) -> Optional[str]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, save_frame, frame, camera_id, detection_id, detections, dt
    )


async def save_plate_crop_async(
    plate_crop: np.ndarray,
    camera_id: str,
    detection_id: str,
    plate_text: Optional[str] = None,
    dt: Optional[datetime] = None,
) -> Optional[str]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, save_plate_crop, plate_crop, camera_id, detection_id, plate_text, dt
    )


# ── Internal helpers ──────────────────────────────────────────────

def _draw_detections(frame: np.ndarray, detections: list) -> np.ndarray:
    """Draws vehicle bounding boxes and plate boxes on the frame."""
    for det in detections:
        # Vehicle box — green
        x1, y1, x2, y2 = det.bbox.as_tuple
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        label = f"{det.class_name} {det.confidence:.2f}"
        _draw_label(frame, label, x1, y1, (0, 255, 0))

        # Plate box — cyan
        if det.plate_bbox:
            px1, py1, px2, py2 = det.plate_bbox.as_tuple
            cv2.rectangle(frame, (px1, py1), (px2, py2), (255, 255, 0), 2)

    # Timestamp overlay
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    cv2.putText(
        frame, ts, (10, frame.shape[0] - 10),
        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1, cv2.LINE_AA,
    )
    return frame


def _draw_label(
    frame: np.ndarray, text: str, x: int, y: int, color: Tuple[int, int, int]
) -> None:
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
    cv2.rectangle(frame, (x, y - th - 6), (x + tw + 4, y), color, -1)
    cv2.putText(
        frame, text, (x + 2, y - 3),
        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 1, cv2.LINE_AA,
    )
