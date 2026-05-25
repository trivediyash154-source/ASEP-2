"""Camera management schemas."""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.constants import CameraStatus


class CameraCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    camera_id: str = Field(..., min_length=2, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    location: str = Field(..., min_length=2)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    stream_url: Optional[str] = None
    rtsp_url: Optional[str] = None
    resolution_width: Optional[int] = None
    resolution_height: Optional[int] = None
    fps: Optional[int] = Field(None, ge=1, le=120)
    description: Optional[str] = None


class CameraResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    name: str
    camera_id: str
    location: str
    latitude: Optional[float]
    longitude: Optional[float]
    status: CameraStatus
    is_active: bool
    resolution_width: Optional[int]
    resolution_height: Optional[int]
    fps: Optional[int]
    last_seen: Optional[datetime]
    total_detections: int
    error_count: int
    description: Optional[str]
    created_at: datetime


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    stream_url: Optional[str] = None
    rtsp_url: Optional[str] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None
