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
    fuel_rate_lph: Optional[float] = None
    fuel_consumption_l_100km: Optional[float] = None
    mass_air_flow_gps: Optional[float] = None
    fuel_rate_source: Optional[str] = Field(default=None, max_length=32)
    dtcs: list[ObdDiagnosticCode] = Field(default_factory=list)

    @field_validator("source")
    @classmethod
    def source_allowed(cls, v: str) -> str:
        n = v.strip().lower()
        if n not in ("device", "simulated"):
            raise ValueError("source must be 'device' or 'simulated'")
        return n

    @field_validator("fuel_rate_source")
    @classmethod
    def fuel_rate_source_allowed(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        n = v.strip().lower()
        if n not in ("pid_015e", "maf_estimate"):
            raise ValueError("fuel_rate_source must be 'pid_015e' or 'maf_estimate'")
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
    fuel_rate_lph: Optional[float] = None
    fuel_consumption_l_100km: Optional[float] = None
    mass_air_flow_gps: Optional[float] = None
    fuel_rate_source: Optional[str] = None
    dtcs: list[ObdDiagnosticCode] = []
    created_at: datetime

    class Config:
        from_attributes = True
