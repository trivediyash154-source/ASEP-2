"""Admin endpoints — user management, audit logs, role changes."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.middleware.auth_middleware import get_current_active_user
from app.models.user import User, AuditLog
from app.core.constants import UserRole
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


def _require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role not in (UserRole.ADMIN, UserRole.SUPERADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def _require_superadmin(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Superadmin access required")
    return current_user


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    result = await db.execute(
        select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)
    )
    return [UserResponse.model_validate(u) for u in result.scalars().all()]


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(_require_superadmin),
):
    new_role = body.get("role")
    if new_role not in [r.value for r in UserRole]:
        raise HTTPException(status_code=400, detail=f"Invalid role: {new_role}")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if str(user.id) == str(actor.id):
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    old_role = user.role
    user.role = UserRole(new_role)
    await db.commit()
    return {"id": str(user.id), "old_role": old_role, "new_role": new_role}


@router.patch("/users/{user_id}/active")
async def toggle_user_active(
    user_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(_require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if str(user.id) == str(actor.id):
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    user.is_active = bool(body.get("is_active", not user.is_active))
    await db.commit()
    return {"id": str(user.id), "is_active": user.is_active}


@router.get("/audit-logs")
async def list_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    action: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    q = select(AuditLog, User.email, User.full_name).join(
        User, AuditLog.user_id == User.id, isouter=True
    ).order_by(desc(AuditLog.created_at)).offset(skip).limit(limit)

    if action:
        q = q.where(AuditLog.action == action)

    result = await db.execute(q)
    rows = result.all()
    return [
        {
            "id": str(log.id),
            "action": log.action,
            "resource": log.resource,
            "resource_id": log.resource_id,
            "details": log.details,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat(),
            "user_email": email,
            "user_name": name,
        }
        for log, email, name in rows
    ]


@router.get("/stats")
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    user_count = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    active_users = (await db.execute(
        select(func.count()).select_from(User).where(User.is_active == True)  # noqa: E712
    )).scalar_one()
    audit_count = (await db.execute(select(func.count()).select_from(AuditLog))).scalar_one()

    role_counts_result = await db.execute(
        select(User.role, func.count().label("n")).group_by(User.role)
    )
    role_counts = {row.role: row.n for row in role_counts_result}

    return {
        "total_users": user_count,
        "active_users": active_users,
        "audit_events": audit_count,
        "role_distribution": role_counts,
    }
