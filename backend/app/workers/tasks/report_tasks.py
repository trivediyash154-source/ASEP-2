"""Scheduled report and maintenance tasks."""
from app.core.logging import get_logger
from app.workers.celery_app import celery_app

logger = get_logger(__name__)


@celery_app.task(name="app.workers.tasks.report_tasks.mark_overdue_challans")
def mark_overdue_challans() -> dict:
    import asyncio

    async def _run():
        from app.db.session import get_db_context
        from app.core.constants import ChallanStatus
        from app.models.challan import Challan
        from datetime import date
        from sqlalchemy import and_, select, update

        async with get_db_context() as db:
            stmt = (
                update(Challan)
                .where(
                    and_(
                        Challan.status == ChallanStatus.ISSUED,
                        Challan.due_date < date.today(),
                    )
                )
                .values(status=ChallanStatus.OVERDUE)
            )
            result = await db.execute(stmt)
            count = result.rowcount
            logger.info("challans_marked_overdue", count=count)
            return {"updated": count}

    return asyncio.run(_run())
