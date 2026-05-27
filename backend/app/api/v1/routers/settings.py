"""System settings CRUD — pipeline thresholds, storage, notifications."""
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.middleware.auth_middleware import get_current_active_user, require_operator
from app.models.user import User
from app.models.system_setting import SystemSetting
from app.core.constants import UserRole

router = APIRouter(prefix="/settings", tags=["Settings"])


def _require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role not in (UserRole.ADMIN, UserRole.SUPERADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


@router.get("")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_operator),
) -> Dict[str, Any]:
    result = await db.execute(select(SystemSetting).order_by(SystemSetting.category, SystemSetting.key))
    rows = result.scalars().all()
    return {
        row.key: {
            "value": row.value,
            "description": row.description,
            "category": row.category,
            "updated_by": row.updated_by,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }
        for row in rows
    }


@router.put("")
async def update_settings(
    body: Dict[str, str],
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(_require_admin),
) -> Dict[str, Any]:
    updated = []
    for key, value in body.items():
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail=f"Unknown setting key: {key!r}")
        row.value = str(value)
        row.updated_by = actor.email
        updated.append(key)

    await db.commit()
    return {"updated": updated, "count": len(updated)}


@router.put("/{key}")
async def update_single_setting(
    key: str,
    body: Dict[str, str],
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(_require_admin),
):
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Unknown setting key: {key!r}")

    row.value = str(body.get("value", row.value))
    row.updated_by = actor.email
    await db.commit()
    return {"key": key, "value": row.value, "updated_by": row.updated_by}
