"""
One-shot demo auth recovery.

Run this whenever login is broken and you need a known-good state:

    docker exec enforcement-backend python -m scripts.reset_demo_auth

It will:
  • Upsert the three demo users (admin/operator/viewer)
  • Re-hash their passwords from scratch so a corrupted hash is overwritten
  • Reset failed_login_attempts and clear any account lock
  • Ensure roles, is_active, and is_verified are correct
  • Drop all outstanding refresh tokens for those users (so a stale token
    never re-binds them to a previous password)

The passwords match what the /login UI's persona buttons auto-fill
(see frontend src/app/(auth)/login/page.tsx). Changing them here without
updating the persona constants will break the demo flow.

Exit code 0 on success, non-zero on any DB error.
"""
import asyncio
import sys

from sqlalchemy import select, delete

from app.core.constants import UserRole
from app.core.logging import get_logger
from app.core.security import hash_password, verify_password
from app.db.session import AsyncSessionFactory
from app.models.user import RefreshToken, User

logger = get_logger(__name__)

DEMO_PASSWORD = "Admin@1234"

DEMO_USERS = [
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


async def reset_demo_auth() -> dict:
    created: list[str] = []
    updated: list[str] = []
    verified: list[str] = []

    async with AsyncSessionFactory() as session:
        for spec in DEMO_USERS:
            email = spec["email"]
            existing = (
                await session.execute(select(User).where(User.email == email))
            ).scalar_one_or_none()

            new_hash = hash_password(DEMO_PASSWORD)

            if existing is None:
                user = User(
                    email=email,
                    username=spec["username"],
                    full_name=spec["full_name"],
                    hashed_password=new_hash,
                    role=spec["role"],
                    is_active=True,
                    is_verified=True,
                )
                session.add(user)
                created.append(email)
            else:
                existing.username = spec["username"]
                existing.full_name = spec["full_name"]
                existing.role = spec["role"]
                existing.hashed_password = new_hash
                existing.is_active = True
                existing.is_verified = True
                existing.failed_login_attempts = 0
                existing.locked_until = None
                # Revoke any outstanding refresh tokens — they were minted
                # under the previous hash and shouldn't bridge identities.
                await session.execute(
                    delete(RefreshToken).where(RefreshToken.user_id == existing.id)
                )
                updated.append(email)

        await session.commit()

        # Round-trip verification: re-read each user and prove the canonical
        # password actually verifies against the stored hash.
        for spec in DEMO_USERS:
            u = (
                await session.execute(select(User).where(User.email == spec["email"]))
            ).scalar_one()
            if not verify_password(DEMO_PASSWORD, u.hashed_password):
                raise RuntimeError(
                    f"Post-reset verify failed for {spec['email']} — "
                    f"hashing pipeline is broken."
                )
            verified.append(spec["email"])

    summary = {
        "password": DEMO_PASSWORD,
        "created": created,
        "updated": updated,
        "verified": verified,
    }
    logger.info("reset_demo_auth_complete", **summary)
    return summary


def _print_summary(summary: dict) -> None:
    print("─" * 56)
    print(" Demo auth reset complete")
    print("─" * 56)
    print(f" Password (all accounts):  {summary['password']}")
    if summary["created"]:
        print(f" Created:                  {', '.join(summary['created'])}")
    if summary["updated"]:
        print(f" Updated:                  {', '.join(summary['updated'])}")
    print(f" Verified hash round-trip: {', '.join(summary['verified'])}")
    print("─" * 56)


if __name__ == "__main__":
    try:
        summary = asyncio.run(reset_demo_auth())
    except Exception as exc:
        print(f"reset_demo_auth failed: {exc}", file=sys.stderr)
        sys.exit(1)
    _print_summary(summary)
