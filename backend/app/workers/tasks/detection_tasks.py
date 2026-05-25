"""
Celery tasks for violation processing and evidence lifecycle.

process_detection_violation:
  Called by the pipeline after a violation is confirmed.
  Flow:
    1. Verify the Detection record exists in the DB
    2. Look up vehicle owner contact info
    3. Create a Challan record
    4. Attach evidence paths
    5. Queue SMS + email notifications
    6. Broadcast challan_issued event via Redis pub/sub → WebSocket
"""

import asyncio
from typing import Optional

from app.core.logging import get_logger
from app.workers.celery_app import celery_app

logger = get_logger(__name__)


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    name="app.workers.tasks.detection_tasks.process_detection_violation",
    acks_late=True,
)
def process_detection_violation(
    self,
    detection_id: str,
    plate_number: str,
    violation_type: str,
    violation_description: str,
    fine_amount: float,
    frame_path: Optional[str] = None,
    plate_path: Optional[str] = None,
) -> dict:
    """
    Creates a challan for a confirmed violation and triggers notifications.
    Idempotent: if a challan already exists for this detection_id it returns
    the existing challan number without creating a duplicate.
    """
    return asyncio.run(_async_process_violation(
        detection_id=detection_id,
        plate_number=plate_number,
        violation_type=violation_type,
        violation_description=violation_description,
        fine_amount=fine_amount,
        frame_path=frame_path,
        plate_path=plate_path,
    ))


async def _async_process_violation(
    detection_id: str,
    plate_number: str,
    violation_type: str,
    violation_description: str,
    fine_amount: float,
    frame_path: Optional[str],
    plate_path: Optional[str],
) -> dict:
    from app.db.session import get_db_context

    async with get_db_context() as db:
        # ── 1. Verify detection exists ────────────────────────────
        import uuid
        from app.models.detection import Detection
        from sqlalchemy import select

        result = await db.execute(
            select(Detection).where(Detection.id == uuid.UUID(detection_id))
        )
        detection = result.scalar_one_or_none()

        if detection is None:
            logger.error(
                "challan_task_detection_not_found",
                detection_id=detection_id,
                note="The task may have run before the Detection row was committed — "
                     "the pipeline uses countdown=2s to avoid this",
            )
            raise ValueError(f"Detection {detection_id} not found in database")

        # ── 2. Idempotency check ──────────────────────────────────
        from app.models.challan import Challan
        from app.core.constants import ChallanStatus

        existing = await db.execute(
            select(Challan).where(Challan.detection_id == uuid.UUID(detection_id))
        )
        existing_challan = existing.scalar_one_or_none()
        if existing_challan:
            logger.info(
                "challan_already_exists_skipping",
                challan_number=existing_challan.challan_number,
                detection_id=detection_id,
            )
            return {"challan_number": existing_challan.challan_number, "created": False}

        # ── 3. Get vehicle owner contact info ─────────────────────
        owner_name: Optional[str] = None
        owner_phone: Optional[str] = None
        owner_email: Optional[str] = None
        location: Optional[str] = None

        if detection.vehicle_id:
            from app.models.vehicle import Vehicle
            from sqlalchemy.orm import selectinload
            veh_result = await db.execute(
                select(Vehicle)
                .where(Vehicle.id == detection.vehicle_id)
                .options(selectinload(Vehicle.owner))
            )
            vehicle = veh_result.scalar_one_or_none()
            if vehicle and vehicle.owner:
                owner_name = vehicle.owner.name
                owner_phone = vehicle.owner.phone
                owner_email = vehicle.owner.email

        # Camera location
        if detection.camera_id:
            from app.models.camera import Camera
            cam_result = await db.execute(
                select(Camera).where(Camera.id == detection.camera_id)
            )
            cam = cam_result.scalar_one_or_none()
            if cam:
                location = cam.location

        # ── 4. Generate challan number ────────────────────────────
        from app.repositories.challan_repo import ChallanRepository
        repo = ChallanRepository(db)
        challan_number = await repo.generate_challan_number()

        # ── 5. Create Challan record ──────────────────────────────
        import json
        from datetime import date, datetime, timedelta, timezone

        evidence_paths = {}
        if frame_path:
            evidence_paths["frame"] = frame_path
        if plate_path:
            evidence_paths["plate"] = plate_path

        challan = Challan(
            challan_number=challan_number,
            detection_id=uuid.UUID(detection_id),
            vehicle_id=detection.vehicle_id,
            plate_number=plate_number,
            violation_type=violation_type,
            violation_description=violation_description,
            fine_amount=fine_amount,
            status=ChallanStatus.ISSUED,
            issued_at=datetime.now(timezone.utc),
            due_date=date.today() + timedelta(days=30),
            location=location,
            owner_name=owner_name,
            owner_phone=owner_phone,
            owner_email=owner_email,
            evidence_paths=evidence_paths if evidence_paths else None,
        )
        db.add(challan)
        await db.flush()
        await db.refresh(challan)

        challan_id = str(challan.id)
        logger.info(
            "challan_created",
            challan_number=challan_number,
            plate=plate_number,
            violation=violation_type,
            fine=fine_amount,
            owner_phone=bool(owner_phone),
            owner_email=bool(owner_email),
        )

    # ── 6. Trigger notifications (outside the DB transaction) ────
    if owner_phone:
        _send_sms_notification(challan_id, challan_number, plate_number, fine_amount, owner_phone)

    if owner_email:
        _send_email_notification(
            challan_id, challan_number, plate_number, violation_type, fine_amount, owner_email, owner_name
        )

    # ── 7. Broadcast challan_issued WebSocket event via Redis ───
    _broadcast_challan_issued(challan_number, plate_number, violation_type, fine_amount)

    return {"challan_number": challan_number, "created": True}


def _send_sms_notification(
    challan_id: str, challan_number: str, plate: str, fine: float, phone: str
) -> None:
    from app.workers.tasks.notification_tasks import send_challan_sms

    message = (
        f"Traffic Violation Notice\n"
        f"Challan: {challan_number}\n"
        f"Vehicle: {plate}\n"
        f"Fine: Rs.{fine:,.0f}\n"
        f"Pay within 30 days to avoid penalty.\n"
        f"- AI Enforcement System"
    )
    send_challan_sms.apply_async(
        kwargs={"challan_id": challan_id, "phone": phone, "message": message},
        queue="notifications",
    )


def _send_email_notification(
    challan_id: str, challan_number: str, plate: str,
    violation: str, fine: float, email: str, name: Optional[str]
) -> None:
    from app.workers.tasks.notification_tasks import send_challan_email

    subject = f"Traffic Violation Challan #{challan_number}"
    body = f"""
    <html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:30px;border:1px solid #e0e0e0;">
      <h2 style="color:#c0392b;">⚠️ Traffic Violation Notice</h2>
      <p>Dear {name or 'Vehicle Owner'},</p>
      <p>A traffic violation has been recorded for your vehicle.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Challan Number</td>
            <td style="padding:8px;border:1px solid #ddd;">{challan_number}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Vehicle</td>
            <td style="padding:8px;border:1px solid #ddd;">{plate}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Violation</td>
            <td style="padding:8px;border:1px solid #ddd;">{violation.replace('_', ' ').title()}</td></tr>
        <tr style="background:#fff3cd;"><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Fine Amount</td>
            <td style="padding:8px;border:1px solid #ddd;font-size:1.2em;color:#c0392b;">
              ₹{fine:,.0f}</td></tr>
      </table>
      <p>Please pay within <strong>30 days</strong> to avoid additional penalties.</p>
      <p style="color:#666;font-size:0.85em;">This is an automated notice from the AI Traffic Enforcement System.</p>
    </div></body></html>
    """
    send_challan_email.apply_async(
        kwargs={"challan_id": challan_id, "email": email, "subject": subject, "body": body},
        queue="notifications",
    )


def _broadcast_challan_issued(
    challan_number: str, plate: str, violation: str, fine: float
) -> None:
    """Publish a Redis message that the WebSocket handler picks up."""
    try:
        import redis
        from app.core.config import settings
        from app.core.constants import WS_EVENTS
        import json

        r = redis.from_url(settings.redis_url, decode_responses=True)
        r.publish(
            "ws:broadcasts",
            json.dumps({
                "room": "global:alerts",
                "event": {
                    "event_type": WS_EVENTS["challan_issued"],
                    "challan_number": challan_number,
                    "plate_number": plate,
                    "violation_type": violation,
                    "fine_amount": fine,
                },
            }),
        )
    except Exception as e:
        logger.error("challan_broadcast_failed", error=str(e))


@celery_app.task(name="app.workers.tasks.detection_tasks.cleanup_old_evidence")
def cleanup_old_evidence() -> dict:
    """Removes evidence files older than settings.EVIDENCE_RETENTION_DAYS."""
    import os
    from datetime import datetime, timedelta
    from pathlib import Path
    from app.core.config import settings

    upload_dir = Path(settings.UPLOAD_DIR) / "evidence"
    if not upload_dir.exists():
        return {"removed": 0, "skipped": 0}

    cutoff = datetime.now() - timedelta(days=settings.EVIDENCE_RETENTION_DAYS)
    removed = 0
    skipped = 0

    for f in upload_dir.rglob("*.jpg"):
        try:
            if datetime.fromtimestamp(f.stat().st_mtime) < cutoff:
                f.unlink()
                removed += 1
        except (OSError, PermissionError) as e:
            logger.warning("evidence_file_cleanup_failed", path=str(f), error=str(e))
            skipped += 1

    logger.info("evidence_cleanup_complete", removed=removed, skipped=skipped)
    return {"removed": removed, "skipped": skipped}
