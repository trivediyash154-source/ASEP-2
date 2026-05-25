"""Detection schemas."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.constants import DetectionStatus


class DetectionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    camera_id: Optional[UUID]
    vehicle_id: Optional[UUID]
    detected_plate: Optional[str]
    ocr_confidence: Optional[float]
    vehicle_confidence: Optional[float]
    plate_confidence: Optional[float]
    vehicle_category: Optional[str]
    bounding_box: Optional[Dict[str, Any]]
    plate_bounding_box: Optional[Dict[str, Any]] = None
    timestamp: datetime
    status: DetectionStatus
    is_violation: bool
    violation_type: Optional[str]
    processing_time_ms: Optional[int]
    frame_path: Optional[str]
    plate_crop_path: Optional[str]
    created_at: datetime


class DetectionListResponse(BaseModel):
    items: List[DetectionResponse]
    total: int
    page: int
    page_size: int


class DetectionStatsResponse(BaseModel):
    total_24h: int
    violations_24h: int
    avg_confidence: float
    success_rate: float
    hourly_breakdown: List[Dict[str, Any]]
