"""
Controlled Demo Replay endpoints.

Operator-driven, deterministic counterpart to the live mobile-camera demo:

  GET  /demo/cases             — list curated cases (id, title, image, severity)
  GET  /demo/cases/{id}        — single case detail (no replay yet)
  POST /demo/replay/{id}       — persist + broadcast the case's outcome,
                                  return full payload for stage animation

All endpoints require authentication. Replay writes real Detection +
Challan rows so existing dashboards/analytics react to the demo events
without any special-casing.
"""
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.middleware.auth_middleware import get_current_active_user
from app.models.user import User
from app.services import demo_cases as demo_cases_module
from app.services.demo_replay import run_case

router = APIRouter(prefix="/demo", tags=["Demo"])


def _summarize_case(c: demo_cases_module.DemoCase) -> dict:
    """Lightweight projection for the gallery list."""
    return {
        "id": c.id,
        "title": c.title,
        "subtitle": c.subtitle,
        "image": c.image,
        "thumbnail_caption": c.thumbnail_caption,
        "plate": c.plate,
        "severity": c.severity,
        "is_violation": c.is_violation,
        "violation_type": c.violation_type,
        "threat_score": c.threat_score,
        "camera_code": c.camera_code,
        "location": c.location,
        "ocr_confidence": c.ocr_confidence,
        "vehicle_category": c.vehicle_category,
        "vehicle_make": c.vehicle_make,
        "vehicle_model": c.vehicle_model,
    }


@router.get("/cases")
async def list_demo_cases(_: User = Depends(get_current_active_user)):
    """Curated gallery of replay-ready scenarios."""
    return {"cases": [_summarize_case(c) for c in demo_cases_module.list_cases()]}


@router.get("/cases/{case_id}")
async def get_demo_case(
    case_id: str,
    _: User = Depends(get_current_active_user),
):
    case = demo_cases_module.get_case(case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demo case not found")
    return {
        **_summarize_case(case),
        "stages": [asdict(s) for s in case.stages],
        "compliance": case.compliance,
        "history": case.history,
        "telemetry_preview": {
            "ocr_confidence": case.ocr_confidence,
            "vehicle_confidence": case.vehicle_confidence,
            "plate_confidence": case.plate_confidence,
            "frame_quality": case.frame_quality,
            "ocr_engine": case.ocr_engine,
        },
    }


@router.post("/replay/{case_id}")
async def replay_case(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """
    Fires the case end-to-end:

      * Upserts owner/vehicle (so repeat runs share history).
      * Persists a real Detection row with the case's pre-computed outcomes.
      * If violation, issues a real Challan.
      * Broadcasts to global:detections, global:alerts, camera:{id}.
      * Returns the full case payload + stage timeline for the frontend to
        animate.

    The frontend uses the returned `stages` array (latency_ms each) as the
    animation script. Real-world processing already happened; the timeline
    is for *visualisation*.
    """
    case = demo_cases_module.get_case(case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demo case not found")
    payload = await run_case(db, case)
    return payload
