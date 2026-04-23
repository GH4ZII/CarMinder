from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class OcrFieldConfidence(BaseModel):
    event_date: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    cost: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    vendor: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    notes: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    mileage: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class ReceiptOcrResponse(BaseModel):
    event_date: Optional[date] = None
    cost: Optional[float] = Field(default=None, ge=0.0)
    vendor: Optional[str] = None
    notes: Optional[str] = None
    mileage: Optional[int] = Field(default=None, ge=0)
    confidence: OcrFieldConfidence = Field(default_factory=OcrFieldConfidence)

    @field_validator("vendor", "notes")
    @classmethod
    def normalize_optional_text(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned if cleaned else None
