"""Challan management endpoints."""
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.db.session import get_db
from app.middleware.auth_middleware import get_current_active_user, require_operator
from app.models.user import User
from app.repositories.challan_repo import ChallanRepository
from app.schemas.challan import (
    ChallanCreate, ChallanListPublicResponse, ChallanListResponse,
    ChallanPublicResponse, ChallanResponse, ChallanStatsResponse,
    ChallanUpdateStatus,
)
from app.services.challan_service import ChallanService


def _can_view_pii(user: User) -> bool:
    """PII (owner contact, paid_amount) is visible to operator and above —
    never to a read-only viewer. Enforced server-side; we don't rely on the
    frontend to hide fields."""
    return user.role in (UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.OPERATOR)

router = APIRouter(prefix="/challans", tags=["Challans"])


@router.get("/")
async def list_challans(
    page: int = 1,
    page_size: int = 20,
    status_filter: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Returns the full-PII schema for operator+, or the PII-stripped
    schema for viewers. FastAPI's response model is selected at runtime so
    the OpenAPI surface reflects the operator-or-above contract."""
    repo = ChallanRepository(db)
    filters = {"status": status_filter} if status_filter else None
    skip = (page - 1) * page_size
    items = await repo.get_all(skip=skip, limit=page_size, filters=filters)
    total = await repo.count(filters=filters)
    if _can_view_pii(current_user):
        return ChallanListResponse(
            items=[ChallanResponse.model_validate(c) for c in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    return ChallanListPublicResponse(
        items=[ChallanPublicResponse.model_validate(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/", response_model=ChallanResponse, status_code=status.HTTP_201_CREATED)
async def issue_challan(
    body: ChallanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    service = ChallanService(db)
    try:
        return await service.issue_challan(body, issued_by_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/stats", response_model=ChallanStatsResponse)
async def get_challan_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    repo = ChallanRepository(db)
    stats = await repo.revenue_stats()
    overdue = await repo.get_overdue()
    from app.core.constants import ChallanStatus
    paid_count = await repo.count(filters={"status": ChallanStatus.PAID})
    total_issued = stats["total_issued"]
    total_collected = stats["total_collected"]
    collection_rate = round(total_collected / max(total_issued, 1) * 100, 1)
    return ChallanStatsResponse(
        total_issued=total_issued,
        total_collected=total_collected,
        pending_count=stats["pending_count"],
        paid_count=paid_count,
        overdue_count=len(overdue),
        collection_rate=collection_rate,
    )


@router.get("/{challan_id}")
async def get_challan(
    challan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    repo = ChallanRepository(db)
    challan = await repo.get(challan_id)
    if not challan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challan not found")
    if _can_view_pii(current_user):
        return ChallanResponse.model_validate(challan)
    return ChallanPublicResponse.model_validate(challan)


@router.patch("/{challan_id}/status", response_model=ChallanResponse)
async def update_challan_status(
    challan_id: uuid.UUID,
    body: ChallanUpdateStatus,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_operator),
):
    service = ChallanService(db)
    try:
        return await service.update_status(challan_id, body)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{challan_id}/pdf")
async def download_challan_pdf(
    challan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_operator),    # PDF embeds owner PII → operator+
):
    service = ChallanService(db)
    try:
        pdf_bytes = await service.generate_pdf(challan_id)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=challan_{challan_id}.pdf"},
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
