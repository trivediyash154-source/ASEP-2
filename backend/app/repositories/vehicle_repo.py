"""
Vehicle repository with real plate-number lookup.

Supports exact match and trigram-based fuzzy matching (requires pg_trgm extension).
"""
import uuid
from datetime import date
from typing import List, Optional

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.vehicle import Owner, Vehicle
from app.repositories.base import BaseRepository
from app.core.logging import get_logger

logger = get_logger(__name__)


class VehicleRepository(BaseRepository[Vehicle]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Vehicle, db)

    async def get_by_plate(self, plate_number: str) -> Optional[Vehicle]:
        """Exact match lookup — case-insensitive, normalised."""
        normalized = plate_number.upper().strip()
        result = await self.db.execute(
            select(Vehicle)
            .where(func.upper(Vehicle.plate_number) == normalized)
            .options(selectinload(Vehicle.owner))
        )
        return result.scalar_one_or_none()

    async def fuzzy_lookup(self, plate_number: str, max_results: int = 5) -> List[Vehicle]:
        """
        Returns vehicles whose plate number is similar to the query
        using PostgreSQL pg_trgm similarity scoring.
        Falls back to prefix/suffix LIKE if pg_trgm is not available.
        """
        normalized = plate_number.upper().strip()
        try:
            result = await self.db.execute(
                text(
                    """
                    SELECT id FROM vehicles
                    WHERE similarity(plate_number, :plate) > 0.3
                    ORDER BY similarity(plate_number, :plate) DESC
                    LIMIT :limit
                    """
                ),
                {"plate": normalized, "limit": max_results},
            )
            ids = [row[0] for row in result]
            if not ids:
                return []
            query = select(Vehicle).where(Vehicle.id.in_(ids)).options(selectinload(Vehicle.owner))
            result2 = await self.db.execute(query)
            return list(result2.scalars().all())
        except Exception:
            # pg_trgm not available — fall back to LIKE
            logger.warning("fuzzy_lookup_falling_back_to_like", plate=normalized)
            result = await self.db.execute(
                select(Vehicle)
                .where(
                    or_(
                        Vehicle.plate_number.ilike(f"{normalized}%"),
                        Vehicle.plate_number.ilike(f"%{normalized}"),
                        Vehicle.plate_number.ilike(f"%{normalized[2:]}%"),
                    )
                )
                .options(selectinload(Vehicle.owner))
                .limit(max_results)
            )
            return list(result.scalars().all())

    async def get_expired_registrations(self, reference_date: Optional[date] = None) -> List[Vehicle]:
        ref = reference_date or date.today()
        result = await self.db.execute(
            select(Vehicle)
            .where(
                or_(
                    Vehicle.registration_expiry < ref,
                    Vehicle.insurance_expiry < ref,
                    Vehicle.pollution_expiry < ref,
                )
            )
            .options(selectinload(Vehicle.owner))
        )
        return list(result.scalars().all())

    async def get_blacklisted(self) -> List[Vehicle]:
        result = await self.db.execute(
            select(Vehicle).where(Vehicle.is_blacklisted == True).options(selectinload(Vehicle.owner))
        )
        return list(result.scalars().all())
