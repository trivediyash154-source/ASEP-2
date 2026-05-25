"""Challan-specific query methods."""
import uuid
from datetime import date, datetime, timedelta
from typing import List, Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import ChallanStatus
from app.models.challan import Challan
from app.repositories.base import BaseRepository


class ChallanRepository(BaseRepository[Challan]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Challan, db)

    async def get_by_number(self, challan_number: str) -> Optional[Challan]:
        result = await self.db.execute(
            select(Challan)
            .where(Challan.challan_number == challan_number)
            .options(selectinload(Challan.vehicle), selectinload(Challan.notifications))
        )
        return result.scalar_one_or_none()

    async def get_overdue(self) -> List[Challan]:
        result = await self.db.execute(
            select(Challan).where(
                and_(
                    Challan.status == ChallanStatus.ISSUED,
                    Challan.due_date < date.today(),
                )
            )
        )
        return list(result.scalars().all())

    async def revenue_stats(self) -> dict:
        total_issued = await self.db.execute(
            select(func.sum(Challan.fine_amount)).where(Challan.status != ChallanStatus.CANCELLED)
        )
        total_collected = await self.db.execute(
            select(func.sum(Challan.paid_amount)).where(Challan.status == ChallanStatus.PAID)
        )
        pending_count = await self.db.execute(
            select(func.count()).where(Challan.status == ChallanStatus.ISSUED)
        )
        return {
            "total_issued": float(total_issued.scalar_one() or 0),
            "total_collected": float(total_collected.scalar_one() or 0),
            "pending_count": pending_count.scalar_one(),
        }

    async def generate_challan_number(self) -> str:
        today = datetime.utcnow().strftime("%Y%m%d")
        count_result = await self.db.execute(select(func.count()).select_from(Challan))
        count = count_result.scalar_one() + 1
        return f"CH{today}{count:06d}"
