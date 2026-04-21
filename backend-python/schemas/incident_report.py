from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

SEVERITY_LEVELS = ["minor", "moderate", "severe"]
REPAIR_STATUSES = ["not_repaired", "partially_repaired", "fully_repaired"]


class IncidentReportCreate(BaseModel):
    incident_date: date
    severity: str = Field(..., min_length=1, max_length=32)
    description: str = Field(..., min_length=1, max_length=2000)
    damage_description: Optional[str] = None
    repair_status: str = Field(default="not_repaired", max_length=32)
    repair_cost: Optional[float] = None
    repair_vendor: Optional[str] = None
    insurance_claim: bool = False
    mileage: Optional[int] = None

    @field_validator("severity")
    @classmethod
    def severity_allowed(cls, v: str) -> str:
        n = v.strip().lower()
        if n not in SEVERITY_LEVELS:
            raise ValueError(f"severity must be one of: {', '.join(SEVERITY_LEVELS)}")
        return n

    @field_validator("repair_status")
    @classmethod
    def repair_status_allowed(cls, v: str) -> str:
        n = v.strip().lower()
        if n not in REPAIR_STATUSES:
            raise ValueError(f"repair_status must be one of: {', '.join(REPAIR_STATUSES)}")
        return n

    @field_validator("incident_date")
    @classmethod
    def date_not_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("incident_date cannot be in the future")
        return v

    @field_validator("mileage")
    @classmethod
    def mileage_non_negative(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("mileage must be >= 0")
        return v

    @field_validator("repair_cost")
    @classmethod
    def cost_non_negative(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("repair_cost must be >= 0")
        return v

    @field_validator("description", "damage_description", "repair_vendor")
    @classmethod
    def strip_optional_string(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip()
        return s if s else None


class IncidentReportResponse(BaseModel):
    id: str
    car_id: str
    incident_date: date
    severity: str
    description: str
    damage_description: Optional[str] = None
    repair_status: str
    repair_cost_cents: Optional[int] = None
    repair_vendor: Optional[str] = None
    insurance_claim: bool
    mileage: Optional[int] = None
    before_image_url: Optional[str] = None
    after_image_url: Optional[str] = None
    receipt_pdf_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
