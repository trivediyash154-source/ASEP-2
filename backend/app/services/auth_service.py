"""
Authentication and authorization service.
Handles login, token issuance, refresh, and user management.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import UserRole
from app.core.logging import get_logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import AuditLog, RefreshToken, User
from app.schemas.auth import LoginRequest, TokenResponse, UserCreate, UserResponse

logger = get_logger(__name__)

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def authenticate(
        self, request: LoginRequest, ip: Optional[str] = None
    ) -> TokenResponse:
        user = await self._get_user_by_email(request.email)
        if not user:
            raise ValueError("Invalid credentials")

        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            raise ValueError(f"Account locked. Try again after {user.locked_until.strftime('%H:%M UTC')}")

        if not verify_password(request.password, user.hashed_password):
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
                logger.warning("account_locked", user_id=str(user.id), ip=ip)
            self.db.add(user)
            await self.db.flush()
            raise ValueError("Invalid credentials")

        if not user.is_active:
            raise ValueError("Account is disabled")

        # Reset failed attempts on success
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login = datetime.now(timezone.utc)
        self.db.add(user)

        # Issue tokens
        extra_claims = {"role": user.role, "uid": str(user.id)}
        access_token = create_access_token(str(user.id), extra_claims)
        refresh_token = create_refresh_token(str(user.id))

        # Persist refresh token
        rt = RefreshToken(
            user_id=user.id,
            token=refresh_token,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
            ip_address=ip,
        )
        self.db.add(rt)
        await self.db.flush()

        await self._audit(user.id, "login", "auth", success=True, ip=ip)
        logger.info("user_authenticated", user_id=str(user.id), ip=ip)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def refresh(self, refresh_token: str) -> TokenResponse:
        try:
            payload = decode_token(refresh_token)
        except JWTError:
            raise ValueError("Invalid or expired refresh token")

        if payload.get("type") != "refresh":
            raise ValueError("Token type mismatch")

        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.token == refresh_token,
                RefreshToken.is_revoked == False,
            )
        )
        rt = result.scalar_one_or_none()
        if not rt:
            raise ValueError("Refresh token revoked or not found")

        if rt.expires_at < datetime.now(timezone.utc):
            raise ValueError("Refresh token expired")

        user = await self.db.get(User, rt.user_id)
        if not user or not user.is_active:
            raise ValueError("User not found or inactive")

        # Rotate the refresh token
        rt.is_revoked = True
        self.db.add(rt)

        extra_claims = {"role": user.role, "uid": str(user.id)}
        new_access = create_access_token(str(user.id), extra_claims)
        new_refresh = create_refresh_token(str(user.id))

        new_rt = RefreshToken(
            user_id=user.id,
            token=new_refresh,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
        )
        self.db.add(new_rt)
        await self.db.flush()

        return TokenResponse(
            access_token=new_access,
            refresh_token=new_refresh,
            token_type="bearer",
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def create_user(self, data: UserCreate) -> UserResponse:
        existing = await self._get_user_by_email(data.email)
        if existing:
            raise ValueError("Email already registered")

        user = User(
            email=data.email,
            username=data.username,
            full_name=data.full_name,
            hashed_password=hash_password(data.password),
            role=data.role,
            phone=data.phone,
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return UserResponse.model_validate(user)

    async def get_current_user(self, token: str) -> User:
        try:
            payload = decode_token(token)
        except JWTError:
            raise ValueError("Invalid token")

        if payload.get("type") != "access":
            raise ValueError("Token type mismatch")

        user_id = payload.get("sub")
        user = await self.db.get(User, uuid.UUID(user_id))
        if not user or not user.is_active:
            raise ValueError("User not found or inactive")
        return user

    async def _get_user_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def _audit(
        self,
        user_id: uuid.UUID,
        action: str,
        resource: str,
        success: bool = True,
        ip: Optional[str] = None,
    ) -> None:
        log = AuditLog(
            user_id=user_id,
            action=action,
            resource=resource,
            ip_address=ip,
            success=success,
        )
        self.db.add(log)
