"""Camera and stream configuration models."""
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Enum, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import CameraStatus
from app.db.base import BaseModel


class Camera(BaseModel):
    __tablename__ = "cameras"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    camera_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    location: Mapped[str] = mapped_column(String(500), nullable=False)
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    stream_url: Mapped[Optional[str]] = mapped_column(String(1000))
    rtsp_url: Mapped[Optional[str]] = mapped_column(String(1000))
    status: Mapped[CameraStatus] = mapped_column(
        Enum(CameraStatus, name="camerastatus"),
        default=CameraStatus.INACTIVE,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    resolution_width: Mapped[Optional[int]] = mapped_column(Integer)
    resolution_height: Mapped[Optional[int]] = mapped_column(Integer)
    fps: Mapped[Optional[int]] = mapped_column(Integer, default=30)
    description: Mapped[Optional[str]] = mapped_column(Text)
    last_seen: Mapped[Optional[datetime]] = mapped_column()
    total_detections: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[Optional[str]] = mapped_column(Text)

    detections: Mapped[list["Detection"]] = relationship(
        "Detection", back_populates="camera"
    )
