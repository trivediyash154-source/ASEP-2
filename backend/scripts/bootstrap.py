"""
Idempotent first-boot bootstrap.

Runs alembic migrations to head, then seeds the default users. Designed to
be invoked from `main.py`'s lifespan on every startup — both calls are
safe to run repeatedly.
"""
import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config

from app.core.logging import get_logger
from scripts.seed_demo_data import seed_demo_data
from scripts.seed_users import seed_users

logger = get_logger(__name__)

ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"


def _run_migrations_sync() -> None:
    cfg = Config(str(ALEMBIC_INI))
    cfg.set_main_option("script_location", str(ALEMBIC_INI.parent / "alembic"))
    command.upgrade(cfg, "head")


async def run_migrations() -> None:
    """Apply pending alembic migrations. Runs in a thread so we don't block
    the async event loop. Alembic itself is synchronous internally."""
    await asyncio.to_thread(_run_migrations_sync)


async def bootstrap() -> None:
    """Full first-boot sequence — migrations + seed users."""
    try:
        await run_migrations()
        logger.info("alembic_upgrade_head_complete")
    except Exception as exc:
        logger.error("alembic_upgrade_failed", error=str(exc), exc_info=True)
        return

    try:
        summary = await seed_users()
        logger.info("seed_users_complete", **summary)
    except Exception as exc:
        logger.error("seed_users_failed", error=str(exc), exc_info=True)

    try:
        summary = await seed_demo_data()
        logger.info("seed_demo_data_complete", **summary)
    except Exception as exc:
        logger.error("seed_demo_data_failed", error=str(exc), exc_info=True)


if __name__ == "__main__":
    asyncio.run(bootstrap())
