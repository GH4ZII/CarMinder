from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class ObdDiagnosticCode(BaseModel):
    code: str = Field(..., min_length=1, max_length=16)
    description: str = Field(..., max_length=512)


class ObdReadingCreate(BaseModel):
    captured_at: datetime
    source: str = Field(..., max_length=16)
    rpm: Optional[float] = None
    coolant_temp_c: Optional[float] = None
    speed_kph: Optional[float] = None
    engine_load_pct: Optional[float] = None
    battery_voltage: Optional[float] = None
    dtcs: list[ObdDiagnosticCode] = Field(default_factory=list)

    @field_validator("source")
    @classmethod
    def source_allowed(cls, v: str) -> str:
        n = v.strip().lower()
        if n not in ("device", "simulated"):
            raise ValueError("source must be 'device' or 'simulated'")
        return n


class ObdReadingResponse(BaseModel):
    id: str
    car_id: str
    captured_at: datetime
    source: str
    rpm: Optional[float] = None
    coolant_temp_c: Optional[float] = None
    speed_kph: Optional[float] = None
    engine_load_pct: Optional[float] = None
    battery_voltage: Optional[float] = None
    dtcs: list[ObdDiagnosticCode] = []
    created_at: datetime

    class Config:
        from_attributes = True
