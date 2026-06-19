"""Detection history and analytics endpoints."""
import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.db.session import get_db
from app.middleware.auth_middleware import get_current_active_user
from app.models.user import User
from app.repositories.detection_repo import DetectionRepository
from app.schemas.detection import (
    DetectionListPublicResponse,
    DetectionListResponse,
    DetectionPublicResponse,
    DetectionResponse,
    DetectionStatsResponse,
)

router = APIRouter(prefix="/detections", tags=["Detections"])


def _can_view_pii(user: User) -> bool:
    return user.role in (UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.OPERATOR)


def _redact_plate(plate: str | None) -> str | None:
    if not plate or len(plate) < 4:
        return "****"
    return plate[:2] + "*" * (len(plate) - 4) + plate[-2:]


@router.get("/")
async def list_detections(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    violations_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    repo = DetectionRepository(db)
    skip = (page - 1) * page_size
    if violations_only:
        items = await repo.get_violations(skip=skip, limit=page_size)
        total = await repo.count(filters={"is_violation": True})
    else:
        items = await repo.get_all(skip=skip, limit=page_size)
        total = await repo.count()
    if _can_view_pii(current_user):
        return DetectionListResponse(
            items=[DetectionResponse.model_validate(d) for d in items],
            total=total, page=page, page_size=page_size,
        )
    public_items = []
    for d in items:
        obj = DetectionPublicResponse.model_validate(d)
        obj.detected_plate = _redact_plate(obj.detected_plate)
        obj.plate_crop_path = None
        public_items.append(obj)
    return DetectionListPublicResponse(
        items=public_items, total=total, page=page, page_size=page_size,
    )


@router.get("/recent")
async def get_recent_detections(
    limit: int = Query(20, ge=1, le=500),
    camera_id: str | None = Query(None, description="UUID of a specific camera to filter by"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    repo = DetectionRepository(db)
    items = await repo.get_recent(limit=limit, camera_id=camera_id)
    if _can_view_pii(current_user):
        return [DetectionResponse.model_validate(d) for d in items]
    result = []
    for d in items:
        obj = DetectionPublicResponse.model_validate(d)
        obj.detected_plate = _redact_plate(obj.detected_plate)
        obj.plate_crop_path = None
        result.append(obj)
    return result


# NOTE: /stats MUST be declared before /{detection_id}. FastAPI matches
# routes in declaration order, so a `/{detection_id}` route declared first
# will swallow `/stats` as a path param value ("stats") and 400 with
# "Invalid detection id". Keep these in this order.
@router.get("/stats", response_model=DetectionStatsResponse)
async def get_detection_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    repo = DetectionRepository(db)
    stats = await repo.get_stats_last_24h()
    hourly = await repo.hourly_detection_counts(24)
    total = stats["total"]
    violations = stats["violations"]
    return DetectionStatsResponse(
        total_24h=total,
        violations_24h=violations,
        avg_confidence=stats["avg_confidence"],
        success_rate=round((total - violations) / max(total, 1) * 100, 1),
        hourly_breakdown=hourly,
    )


@router.get("/{detection_id}")
async def get_detection(
    detection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        det_uuid = _uuid.UUID(detection_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid detection id")
    repo = DetectionRepository(db)
    item = await repo.get(det_uuid)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Detection not found")
    if _can_view_pii(current_user):
        return DetectionResponse.model_validate(item)
    obj = DetectionPublicResponse.model_validate(item)
    obj.detected_plate = _redact_plate(obj.detected_plate)
    obj.plate_crop_path = None
    return obj
