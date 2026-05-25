"""Challan (traffic fine) models."""
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import ChallanStatus
from app.db.base import BaseModel


class Challan(BaseModel):
    __tablename__ = "challans"

    challan_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )

    # References
    vehicle_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="SET NULL"), index=True
    )
    detection_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("detections.id", ondelete="SET NULL"),
        unique=True,
    )
    issued_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    # Violation details
    violation_type: Mapped[str] = mapped_column(String(100), nullable=False)
    violation_description: Mapped[Optional[str]] = mapped_column(Text)
    plate_number: Mapped[str] = mapped_column(String(20), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(500))
    fine_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    # Status
    status: Mapped[ChallanStatus] = mapped_column(
        Enum(ChallanStatus, name="challanstatus"),
        default=ChallanStatus.ISSUED,
        nullable=False,
        index=True,
    )
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    paid_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    payment_reference: Mapped[Optional[str]] = mapped_column(String(255))

    # Owner contact (snapshot at time of issuance)
    owner_name: Mapped[Optional[str]] = mapped_column(String(255))
    owner_phone: Mapped[Optional[str]] = mapped_column(String(20))
    owner_email: Mapped[Optional[str]] = mapped_column(String(255))

    # Evidence
    evidence_paths: Mapped[Optional[dict]] = mapped_column(JSONB)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    vehicle: Mapped[Optional["Vehicle"]] = relationship("Vehicle", back_populates="challans")
    detection: Mapped[Optional["Detection"]] = relationship(
        "Detection", back_populates="challan"
    )
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification", back_populates="challan"
    )
