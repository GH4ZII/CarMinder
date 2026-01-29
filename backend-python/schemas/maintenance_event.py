

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

EVENT_TYPES = [
    "oil_change",
    "brake_service",
    "tire_change",
    "inspection",
    "repair",
    "other",
]


class MaintenanceEventCreate(BaseModel):
    """Client sends minimal input; server validates and normalizes."""

    event_type: str = Field(..., min_length=1, max_length=64)
    event_date: date
    mileage: Optional[int] = None
    cost: Optional[float] = None  # NOK (or local currency); server converts to cost_cents
    vendor: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("event_type")
    @classmethod
    def event_type_allowed(cls, v: str) -> str:
        n = v.strip().lower()
        if n not in EVENT_TYPES:
            raise ValueError(f"event_type must be one of: {', '.join(EVENT_TYPES)}")
        return n

    @field_validator("event_date")
    @classmethod
    def event_date_not_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("event_date cannot be in the future")
        return v

    @field_validator("mileage")
    @classmethod
    def mileage_non_negative(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("mileage must be >= 0")
        return v

    @field_validator("cost")
    @classmethod
    def cost_non_negative(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("cost must be >= 0")
        return v

    @field_validator("vendor", "notes")
    @classmethod
    def strip_optional_string(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip()
        return s if s else None


class MaintenanceEventResponse(BaseModel):
    """Server returns canonical representation; client only displays."""

    id: str
    car_id: str
    event_type: str
    event_date: date
    mileage: Optional[int] = None
    cost_cents: Optional[int] = None
    vendor: Optional[str] = None
    notes: Optional[str] = None
    receipt_image_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
