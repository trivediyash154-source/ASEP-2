"""Detection-specific query methods."""
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Union

from sqlalchemy import Integer, and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.detection import Detection
from app.repositories.base import BaseRepository


class DetectionRepository(BaseRepository[Detection]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Detection, db)

    async def get_recent(
        self,
        limit: int = 50,
        camera_id: Optional[Union[str, uuid.UUID]] = None,
    ) -> List[Detection]:
        stmt = (
            select(Detection)
            .options(selectinload(Detection.camera), selectinload(Detection.vehicle))
            .order_by(Detection.timestamp.desc())
            .limit(limit)
        )
        if camera_id is not None:
            cid = camera_id if isinstance(camera_id, uuid.UUID) else uuid.UUID(str(camera_id))
            stmt = stmt.where(Detection.camera_id == cid)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_violations(self, skip: int = 0, limit: int = 20) -> List[Detection]:
        result = await self.db.execute(
            select(Detection)
            .where(Detection.is_violation == True)
            .options(selectinload(Detection.vehicle), selectinload(Detection.camera))
            .order_by(Detection.timestamp.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_by_plate(self, plate_number: str) -> List[Detection]:
        result = await self.db.execute(
            select(Detection)
            .where(Detection.detected_plate == plate_number)
            .order_by(Detection.timestamp.desc())
        )
        return list(result.scalars().all())

    async def get_stats_last_24h(self) -> dict:
        since = datetime.utcnow() - timedelta(hours=24)
        total = await self.db.execute(
            select(func.count()).select_from(Detection).where(Detection.timestamp >= since)
        )
        violations = await self.db.execute(
            select(func.count())
            .select_from(Detection)
            .where(and_(Detection.timestamp >= since, Detection.is_violation == True))
        )
        avg_conf = await self.db.execute(
            select(func.avg(Detection.vehicle_confidence))
            .where(Detection.timestamp >= since)
        )
        return {
            "total": total.scalar_one(),
            "violations": violations.scalar_one(),
            "avg_confidence": round(float(avg_conf.scalar_one() or 0), 3),
        }

    async def hourly_detection_counts(self, hours: int = 24) -> List[dict]:
        """Per-hour buckets of total detections and violations over the last N hours.

        Uses CASE+SUM so the violation count is computed in-DB as an integer,
        which Postgres + asyncpg type-resolve cleanly (unlike CAST(bool AS NULL)).
        """
        since = datetime.utcnow() - timedelta(hours=hours)
        violation_int = func.sum(case((Detection.is_violation.is_(True), 1), else_=0))
        result = await self.db.execute(
            select(
                func.date_trunc("hour", Detection.timestamp).label("hour"),
                func.count().label("total"),
                violation_int.label("violations"),
            )
            .where(Detection.timestamp >= since)
            .group_by("hour")
            .order_by("hour")
        )
        return [
            {
                "hour": row.hour.isoformat(),
                "total": int(row.total or 0),
                "violations": int(row.violations or 0),
            }
            for row in result
        ]
