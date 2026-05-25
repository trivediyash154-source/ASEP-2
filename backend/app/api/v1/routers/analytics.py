"""Analytics and dashboard summary endpoints."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.middleware.auth_middleware import get_current_active_user
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard")
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    service = AnalyticsService(db)
    return await service.get_dashboard_summary()


@router.get("/timeline")
async def get_detection_timeline(
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    service = AnalyticsService(db)
    return await service.get_detection_timeline(hours)


@router.get("/system")
async def get_system_metrics(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    service = AnalyticsService(db)
    return await service.get_system_metrics()


@router.get("/cameras")
async def get_camera_analytics(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    service = AnalyticsService(db)
    return await service.get_camera_analytics()


@router.get("/violations")
async def get_violation_breakdown(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    service = AnalyticsService(db)
    return await service.get_violation_breakdown()


@router.get("/ai-performance")
async def get_ai_performance(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    service = AnalyticsService(db)
    return await service.get_ai_performance()
