"""Vehicle and owner registry models."""
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import VehicleCategory
from app.db.base import BaseModel


class Owner(BaseModel):
    __tablename__ = "owners"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(100))
    pincode: Mapped[Optional[str]] = mapped_column(String(10))
    id_proof_type: Mapped[Optional[str]] = mapped_column(String(50))
    id_proof_number: Mapped[Optional[str]] = mapped_column(String(100))

    vehicles: Mapped[list["Vehicle"]] = relationship(
        "Vehicle", back_populates="owner", cascade="all, delete-orphan"
    )


class Vehicle(BaseModel):
    __tablename__ = "vehicles"

    plate_number: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True
    )
    category: Mapped[VehicleCategory] = mapped_column(
        Enum(VehicleCategory, name="vehiclecategory"), nullable=False
    )
    make: Mapped[Optional[str]] = mapped_column(String(100))
    model_name: Mapped[Optional[str]] = mapped_column(String(100))
    color: Mapped[Optional[str]] = mapped_column(String(50))
    year: Mapped[Optional[int]] = mapped_column()
    engine_number: Mapped[Optional[str]] = mapped_column(String(100))
    chassis_number: Mapped[Optional[str]] = mapped_column(String(100))

    # Registration details
    registration_expiry: Mapped[Optional[date]] = mapped_column(Date)
    insurance_expiry: Mapped[Optional[date]] = mapped_column(Date)
    pollution_expiry: Mapped[Optional[date]] = mapped_column(Date)
    is_blacklisted: Mapped[bool] = mapped_column(Boolean, default=False)
    blacklist_reason: Mapped[Optional[str]] = mapped_column(Text)

    owner_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("owners.id", ondelete="SET NULL")
    )

    owner: Mapped[Optional["Owner"]] = relationship("Owner", back_populates="vehicles")
    detections: Mapped[list["Detection"]] = relationship(
        "Detection", back_populates="vehicle"
    )
    challans: Mapped[list["Challan"]] = relationship(
        "Challan", back_populates="vehicle"
    )
