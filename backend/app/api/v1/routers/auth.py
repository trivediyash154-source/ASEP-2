"""Authentication endpoints."""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.middleware.auth_middleware import get_current_active_user
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshTokenRequest, TokenResponse, UserCreate, UserResponse, UserUpdate
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else None
    service = AuthService(db)
    try:
        return await service.authenticate(body, ip=client_ip)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    try:
        return await service.refresh(body.refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_profile(
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


class PreferencesPayload(BaseModel):
    theme: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    default_camera: Optional[str] = None
    timezone: Optional[str] = None
    compact_sidebar: Optional[bool] = None


@router.get("/me/preferences")
async def get_preferences(
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    prefs = getattr(current_user, "preferences", None) or {}
    return {
        "theme": prefs.get("theme", "system"),
        "notifications_enabled": prefs.get("notifications_enabled", True),
        "default_camera": prefs.get("default_camera"),
        "timezone": prefs.get("timezone", "Asia/Kolkata"),
        "compact_sidebar": prefs.get("compact_sidebar", False),
    }


@router.put("/me/preferences")
async def update_preferences(
    body: PreferencesPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    prefs = getattr(current_user, "preferences", None) or {}
    for field, value in body.model_dump(exclude_none=True).items():
        prefs[field] = value
    current_user.preferences = prefs  # type: ignore[assignment]
    db.add(current_user)
    await db.flush()
    return prefs


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    try:
        return await service.create_user(body)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
