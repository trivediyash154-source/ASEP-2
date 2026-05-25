"""
Seed default demo users for the platform.

Idempotent: skips users whose email already exists. Safe to run multiple
times (e.g. on every container start).

Default accounts (all share password "Admin@1234"):
  admin@enforcement.gov     superadmin
  operator@enforcement.gov  operator
  viewer@enforcement.gov    viewer
"""
import asyncio
from typing import Iterable

from sqlalchemy import select

from app.core.constants import UserRole
from app.core.logging import get_logger
from app.core.security import hash_password
from app.db.session import AsyncSessionFactory
from app.models.user import User

logger = get_logger(__name__)

DEMO_PASSWORD = "Admin@1234"

DEFAULT_USERS = [
    {
        "email": "admin@enforcement.gov",
        "username": "admin",
        "full_name": "System Administrator",
        "role": UserRole.SUPERADMIN,
    },
    {
        "email": "operator@enforcement.gov",
        "username": "operator",
        "full_name": "Field Operator",
        "role": UserRole.OPERATOR,
    },
    {
        "email": "viewer@enforcement.gov",
        "username": "viewer",
        "full_name": "Read-only Analyst",
        "role": UserRole.VIEWER,
    },
]


async def seed_users(users: Iterable[dict] = DEFAULT_USERS) -> dict:
    """Create any missing demo users. Returns a summary dict."""
    created: list[str] = []
    existed: list[str] = []

    async with AsyncSessionFactory() as session:
        for spec in users:
            email = spec["email"]
            result = await session.execute(select(User).where(User.email == email))
            if result.scalar_one_or_none():
                existed.append(email)
                continue

            user = User(
                email=email,
                username=spec["username"],
                full_name=spec["full_name"],
                hashed_password=hash_password(DEMO_PASSWORD),
                role=spec["role"],
                is_active=True,
                is_verified=True,
            )
            session.add(user)
            created.append(email)

        await session.commit()

    summary = {"created": created, "existed": existed}
    logger.info("seed_users_complete", **summary)
    return summary


if __name__ == "__main__":
    summary = asyncio.run(seed_users())
    print(f"Created: {summary['created']}")
    print(f"Existed: {summary['existed']}")
