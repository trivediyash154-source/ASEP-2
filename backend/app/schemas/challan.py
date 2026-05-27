"""Challan schemas."""
from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.constants import ChallanStatus


class ChallanCreate(BaseModel):
    detection_id: Optional[UUID] = None
    plate_number: str = Field(..., min_length=4, max_length=20)
    violation_type: str
    violation_description: Optional[str] = None
    fine_amount: float = Field(..., gt=0)
    location: Optional[str] = None
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None
    owner_email: Optional[str] = None
    due_date: Optional[date] = None


class ChallanResponse(BaseModel):
    """Full challan record — includes owner PII. Returned only to roles
    holding `view:pii` (operator, admin, superadmin)."""
    model_config = {"from_attributes": True}

    id: UUID
    challan_number: str
    plate_number: str
    violation_type: str
    violation_description: Optional[str]
    fine_amount: float
    status: ChallanStatus
    issued_at: datetime
    due_date: Optional[date]
    paid_at: Optional[datetime]
    paid_amount: Optional[float]
    owner_name: Optional[str]
    owner_phone: Optional[str]
    owner_email: Optional[str]
    location: Optional[str]
    created_at: datetime


class ChallanPublicResponse(BaseModel):
    """PII-stripped projection for the viewer role. Owner contact fields
    are intentionally absent (not nulled) — the schema mismatch is itself
    documentation that this audience is not authorised to see them."""
    model_config = {"from_attributes": True}

    id: UUID
    challan_number: str
    plate_number: str
    violation_type: str
    violation_description: Optional[str]
    fine_amount: float
    status: ChallanStatus
    issued_at: datetime
    due_date: Optional[date]
    paid_at: Optional[datetime]
    location: Optional[str]
    created_at: datetime
    # PII intentionally absent: owner_name, owner_phone, owner_email, paid_amount


class ChallanListResponse(BaseModel):
    items: List[ChallanResponse]
    total: int
    page: int
    page_size: int


class ChallanListPublicResponse(BaseModel):
    items: List[ChallanPublicResponse]
    total: int
    page: int
    page_size: int


class ChallanUpdateStatus(BaseModel):
    status: ChallanStatus
    payment_reference: Optional[str] = None
    paid_amount: Optional[float] = None
    notes: Optional[str] = None


class ChallanStatsResponse(BaseModel):
    total_issued: float
    total_collected: float
    pending_count: int
    paid_count: int
    overdue_count: int
    collection_rate: float
