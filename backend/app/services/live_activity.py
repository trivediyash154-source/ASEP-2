"""
Synthetic live-activity generator.

Background asyncio task that emits realistic detection events at a steady
cadence while also persisting them. This is what makes the operations
dashboard visibly "live" during demos and development — without it the
activity feed would only move when real cameras are connected.

In production (APP_ENV=production) the generator is a no-op so it can never
contaminate real ingest. Enable explicitly with LIVE_ACTIVITY_ENABLED=true
if you need fake load against a non-prod env that has APP_ENV=production.
"""
import asyncio
import os
import random
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Tuple

from sqlalchemy import select

from app.core.config import settings
from app.core.constants import CameraStatus, DetectionStatus
from app.core.logging import get_logger
from app.db.session import AsyncSessionFactory
from app.models.camera import Camera
from app.models.detection import Detection
from app.models.vehicle import Vehicle
from app.websockets.manager import ws_manager

logger = get_logger(__name__)

# Cadence: avg one event every CADENCE_SECONDS, with jitter
CADENCE_SECONDS = 4.5
JITTER = 2.5


def _is_enabled() -> bool:
    if os.getenv("LIVE_ACTIVITY_ENABLED", "").lower() in ("1", "true", "yes"):
        return True
    return settings.APP_ENV.lower() not in ("production", "prod")


async def _generate_synthetic_evidence(
    plate: str,
    camera_code: str,
    detection_id: str,
    bbox: dict,
    plate_bbox: dict,
    dt: datetime,
) -> Tuple[Optional[str], Optional[str]]:
    """Generate a synthetic surveillance frame + plate crop JPEG for demo purposes.

    Returns (frame_relative_path, plate_relative_path) on success,
    (None, None) if any step fails.
    """

    def _write() -> Tuple[Optional[str], Optional[str]]:
        try:
            import cv2
            import numpy as np

            safe_cam = re.sub(r"[^a-zA-Z0-9_-]", "_", camera_code)[:32] or "synthetic"
            out_dir = (
                Path(settings.UPLOAD_DIR)
                / "evidence"
                / dt.strftime("%Y")
                / dt.strftime("%m")
                / dt.strftime("%d")
                / safe_cam
            )
            out_dir.mkdir(parents=True, exist_ok=True)

            # ── Full surveillance frame (960 × 540) ──────────────────────
            FW, FH = 960, 540
            scale = FW / 1920.0  # bbox coords are in 1920×1080 space

            frame = np.full((FH, FW, 3), 26, dtype=np.uint8)

            # Subtle grid lines for that surveillance-camera look
            for y in range(0, FH, 60):
                cv2.line(frame, (0, y), (FW, y), (38, 38, 35), 1)
            for x in range(0, FW, 60):
                cv2.line(frame, (x, 0), (x, FH), (38, 38, 35), 1)

            # Scale bbox to frame size
            sx1 = int(bbox["x1"] * scale)
            sy1 = int(bbox["y1"] * scale)
            sx2 = int(bbox["x2"] * scale)
            sy2 = int(bbox["y2"] * scale)

            # Vehicle body (slightly lighter fill)
            cv2.rectangle(frame, (sx1, sy1), (sx2, sy2), (56, 54, 48), -1)
            # Green detection bounding box
            cv2.rectangle(frame, (sx1, sy1), (sx2, sy2), (0, 210, 100), 2)
            cv2.putText(
                frame, "vehicle  0.94",
                (sx1 + 4, sy1 + 18),
                cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 210, 100), 1, cv2.LINE_AA,
            )

            # Cyan plate region
            spx1 = int(plate_bbox["x1"] * scale)
            spy1 = int(plate_bbox["y1"] * scale)
            spx2 = int(plate_bbox["x2"] * scale)
            spy2 = int(plate_bbox["y2"] * scale)
            cv2.rectangle(frame, (spx1, spy1), (spx2, spy2), (0, 220, 220), 1)
            cv2.putText(
                frame, plate,
                (spx1, max(spy1 - 4, 10)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 220, 220), 1, cv2.LINE_AA,
            )

            # Camera label and timestamp overlays
            cv2.putText(
                frame, camera_code,
                (10, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (180, 176, 164), 1, cv2.LINE_AA,
            )
            cv2.putText(
                frame, "● REC",
                (FW - 68, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.46, (0, 0, 210), 1, cv2.LINE_AA,
            )
            cv2.putText(
                frame, dt.strftime("%d/%m/%Y  %H:%M:%S UTC"),
                (10, FH - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (148, 144, 136), 1, cv2.LINE_AA,
            )

            frame_abs = out_dir / f"{detection_id}_frame.jpg"
            cv2.imwrite(str(frame_abs), frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            frame_rel = str(frame_abs.relative_to(Path(settings.UPLOAD_DIR)))

            # ── Plate crop (220 × 72, Indian number plate style) ─────────
            PW, PH = 220, 72
            crop = np.full((PH, PW, 3), 248, dtype=np.uint8)

            # Blue IND strip at top
            cv2.rectangle(crop, (0, 0), (PW, 18), (140, 10, 10), -1)
            cv2.putText(
                crop, "IND",
                (PW // 2 - 16, 14),
                cv2.FONT_HERSHEY_SIMPLEX, 0.44, (255, 255, 255), 1, cv2.LINE_AA,
            )
            # Double black border
            cv2.rectangle(crop, (2, 2), (PW - 2, PH - 2), (18, 18, 18), 2)

            # Auto-scale text to fit
            text_scale = max(0.52, min(1.05, 7.0 / max(len(plate), 1)))
            (tw, _), _ = cv2.getTextSize(
                plate, cv2.FONT_HERSHEY_SIMPLEX, text_scale, 2
            )
            tx = max(6, (PW - tw) // 2)
            cv2.putText(
                crop, plate, (tx, PH - 14),
                cv2.FONT_HERSHEY_SIMPLEX, text_scale, (12, 12, 12), 2, cv2.LINE_AA,
            )

            plate_abs = out_dir / f"{detection_id}_plate.jpg"
            cv2.imwrite(str(plate_abs), crop, [cv2.IMWRITE_JPEG_QUALITY, 92])
            plate_rel = str(plate_abs.relative_to(Path(settings.UPLOAD_DIR)))

            return frame_rel, plate_rel

        except Exception as exc:
            logger.warning("synthetic_evidence_generation_failed", error=str(exc))
            return None, None

    try:
        return await asyncio.to_thread(_write)
    except Exception as exc:
        logger.warning("synthetic_evidence_thread_failed", error=str(exc))
        return None, None


async def _emit_one(session) -> Optional[dict]:
    """Pick a random active camera + vehicle, persist a detection, broadcast."""
    cams = (await session.execute(
        select(Camera).where(Camera.status == CameraStatus.ACTIVE)
    )).scalars().all()
    if not cams:
        return None

    vehs = (await session.execute(
        select(Vehicle).order_by(Vehicle.created_at.desc()).limit(200)
    )).scalars().all()
    if not vehs:
        return None

    cam = random.choice(cams)
    veh = random.choice(vehs)
    today = datetime.now(timezone.utc).date()

    is_violation = (
        (veh.registration_expiry and veh.registration_expiry < today)
        or (veh.insurance_expiry and veh.insurance_expiry < today)
        or (veh.pollution_expiry and veh.pollution_expiry < today)
        or veh.is_blacklisted
    )
    violation_type = None
    if veh.is_blacklisted:
        violation_type = "Blacklisted Vehicle"
    elif veh.registration_expiry and veh.registration_expiry < today:
        violation_type = "Expired Registration"
    elif veh.insurance_expiry and veh.insurance_expiry < today:
        violation_type = "Expired Insurance"
    elif veh.pollution_expiry and veh.pollution_expiry < today:
        violation_type = "Expired Pollution Cert"

    now = datetime.now(timezone.utc)

    # Realistic bounding box at 1920×1080 frame size. Vehicles tend to sit
    # in the lower-middle area; plates within them are below center.
    x1 = random.randint(220, 760)
    y1 = random.randint(160, 360)
    width = random.randint(380, 720)
    height = random.randint(220, 460)
    x2 = min(1900, x1 + width)
    y2 = min(1060, y1 + height)
    bbox = {"x1": x1, "y1": y1, "x2": x2, "y2": y2}

    # Plate sits in the lower third of the vehicle bbox, ~28% of its width
    pw = int((x2 - x1) * 0.30)
    ph = max(18, int(pw * 0.28))
    px1 = x1 + (x2 - x1 - pw) // 2
    py1 = y1 + int((y2 - y1) * 0.62)
    plate_bbox = {"x1": px1, "y1": py1, "x2": px1 + pw, "y2": py1 + ph}

    # Pre-assign UUID so we can name evidence files before the DB insert
    det_id = uuid.uuid4()

    # Generate synthetic evidence images (non-blocking, runs in thread)
    frame_path, plate_path = await _generate_synthetic_evidence(
        plate=veh.plate_number,
        camera_code=cam.camera_id,
        detection_id=str(det_id),
        bbox=bbox,
        plate_bbox=plate_bbox,
        dt=now,
    )

    d = Detection(
        id=det_id,
        camera_id=cam.id,
        vehicle_id=veh.id,
        detected_plate=veh.plate_number,
        ocr_confidence=round(random.uniform(0.74, 0.99), 3),
        ocr_raw_text=veh.plate_number,
        vehicle_confidence=round(random.uniform(0.78, 0.99), 3),
        plate_confidence=round(random.uniform(0.68, 0.97), 3),
        vehicle_category=veh.category.value,
        bounding_box=bbox,
        plate_bounding_box=plate_bbox,
        frame_path=frame_path,
        plate_crop_path=plate_path,
        # Detection.timestamp is timezone-naive in the schema
        timestamp=now.replace(tzinfo=None),
        status=DetectionStatus.PROCESSED,
        is_violation=bool(is_violation),
        violation_type=violation_type,
        processing_time_ms=random.randint(110, 230),
    )
    session.add(d)
    cam.total_detections = (cam.total_detections or 0) + 1
    # Camera.last_seen is a timezone-naive column in the schema
    cam.last_seen = now.replace(tzinfo=None)
    session.add(cam)
    await session.commit()
    await session.refresh(d)

    payload = {
        "type": "detection",
        "id": str(d.id),
        "camera_id": str(cam.id),
        "camera_code": cam.camera_id,
        "camera_name": cam.name,
        "camera_location": cam.location,
        "plate": d.detected_plate,
        "ocr_confidence": d.ocr_confidence,
        "vehicle_confidence": d.vehicle_confidence,
        "plate_confidence": d.plate_confidence,
        "vehicle_category": d.vehicle_category,
        "vehicle_make": veh.make,
        "vehicle_model": veh.model_name,
        "vehicle_color": veh.color,
        "vehicle_year": veh.year,
        "is_violation": d.is_violation,
        "violation_type": d.violation_type,
        "processing_time_ms": d.processing_time_ms,
        "bounding_box": bbox,
        "plate_bounding_box": plate_bbox,
        "frame_width": 1920,
        "frame_height": 1080,
        "timestamp": d.timestamp.isoformat(),
    }
    return payload


async def run_loop() -> None:
    """Long-running generator loop. Cancelled on app shutdown."""
    if not _is_enabled():
        logger.info("live_activity_disabled", env=settings.APP_ENV)
        return

    logger.info("live_activity_started", cadence_s=CADENCE_SECONDS)
    # Initial warm-up delay so we don't fire before bootstrap finishes
    await asyncio.sleep(3.5)

    while True:
        try:
            async with AsyncSessionFactory() as session:
                payload = await _emit_one(session)
            if payload:
                await ws_manager.broadcast_to_room("global:detections", payload)
                if payload.get("is_violation"):
                    await ws_manager.broadcast_to_room("global:alerts", payload)
                await ws_manager.broadcast_to_room(f"camera:{payload['camera_id']}", payload)
        except asyncio.CancelledError:
            logger.info("live_activity_stopped")
            raise
        except Exception as exc:
            logger.error("live_activity_iteration_failed", error=str(exc), exc_info=True)

        delay = max(0.8, random.gauss(CADENCE_SECONDS, JITTER))
        await asyncio.sleep(delay)


async def start() -> asyncio.Task:
    """Spawn the generator and return its Task so the caller can cancel on shutdown."""
    return asyncio.create_task(run_loop(), name="live-activity-generator")
