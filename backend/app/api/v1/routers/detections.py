"""Detection history and analytics endpoints."""
import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.middleware.auth_middleware import get_current_active_user
from app.repositories.detection_repo import DetectionRepository
from app.schemas.detection import DetectionListResponse, DetectionResponse, DetectionStatsResponse

router = APIRouter(prefix="/detections", tags=["Detections"])


@router.get("/", response_model=DetectionListResponse)
async def list_detections(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    violations_only: bool = False,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    repo = DetectionRepository(db)
    skip = (page - 1) * page_size
    if violations_only:
        items = await repo.get_violations(skip=skip, limit=page_size)
        total = await repo.count(filters={"is_violation": True})
    else:
        items = await repo.get_all(skip=skip, limit=page_size)
        total = await repo.count()
    return DetectionListResponse(
        items=[DetectionResponse.model_validate(d) for d in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/recent", response_model=list[DetectionResponse])
async def get_recent_detections(
    limit: int = Query(20, ge=1, le=100),
    camera_id: str | None = Query(None, description="UUID of a specific camera to filter by"),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    repo = DetectionRepository(db)
    items = await repo.get_recent(limit=limit, camera_id=camera_id)
    return [DetectionResponse.model_validate(d) for d in items]


@router.get("/{detection_id}", response_model=DetectionResponse)
async def get_detection(
    detection_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Single detection lookup — used by the evidence drawer for a deep-fetch."""
    try:
        det_uuid = _uuid.UUID(detection_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid detection id")
    repo = DetectionRepository(db)
    item = await repo.get(det_uuid)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Detection not found")
    return DetectionResponse.model_validate(item)


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
