"""AI detection event models."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import DetectionStatus, VehicleCategory
from app.db.base import BaseModel


class Detection(BaseModel):
    __tablename__ = "detections"

    # Foreign keys
    camera_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cameras.id", ondelete="SET NULL"), index=True
    )
    vehicle_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="SET NULL"), index=True
    )

    # OCR results
    detected_plate: Mapped[Optional[str]] = mapped_column(String(20), index=True)
    ocr_confidence: Mapped[Optional[float]] = mapped_column(Float)
    ocr_raw_text: Mapped[Optional[str]] = mapped_column(String(100))

    # AI detection metadata
    vehicle_confidence: Mapped[Optional[float]] = mapped_column(Float)
    plate_confidence: Mapped[Optional[float]] = mapped_column(Float)
    vehicle_category: Mapped[Optional[str]] = mapped_column(String(50))
    bounding_box: Mapped[Optional[dict]] = mapped_column(JSONB)
    plate_bounding_box: Mapped[Optional[dict]] = mapped_column(JSONB)

    # Evidence
    frame_path: Mapped[Optional[str]] = mapped_column(String(500))
    plate_crop_path: Mapped[Optional[str]] = mapped_column(String(500))
    frame_number: Mapped[Optional[int]] = mapped_column(Integer)
    timestamp: Mapped[datetime] = mapped_column(nullable=False, index=True)

    # Processing status
    status: Mapped[DetectionStatus] = mapped_column(
        Enum(DetectionStatus, name="detectionstatus"),
        default=DetectionStatus.PENDING,
        nullable=False,
        index=True,
    )
    is_violation: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    violation_type: Mapped[Optional[str]] = mapped_column(String(100))
    processing_time_ms: Mapped[Optional[int]] = mapped_column(Integer)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    extra_metadata: Mapped[Optional[dict]] = mapped_column(JSONB)

    camera: Mapped[Optional["Camera"]] = relationship("Camera", back_populates="detections")
    vehicle: Mapped[Optional["Vehicle"]] = relationship("Vehicle", back_populates="detections")
    challan: Mapped[Optional["Challan"]] = relationship("Challan", back_populates="detection")
