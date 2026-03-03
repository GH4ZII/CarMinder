"""
Ownership twin schemas.

Provides request/response contracts for "what-if" scenario simulation
on top of the existing deterministic scoring engine.
"""
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from schemas.maintenance_event import EVENT_TYPES


class OwnershipTwinRequest(BaseModel):
    """Scenario request for ownership twin simulation."""

    action: Literal["delay", "do_now"] = "delay"
    event_type: str = Field(..., min_length=1, max_length=64)
    delay_days: int = Field(60, ge=1, le=365)
    monthly_km: int = Field(1200, ge=0, le=10000)

    @field_validator("event_type")
    @classmethod
    def event_type_allowed(cls, v: str) -> str:
        n = v.strip().lower()
        if n not in EVENT_TYPES:
            raise ValueError(f"event_type must be one of: {', '.join(EVENT_TYPES)}")
        return n


class OwnershipTwinScore(BaseModel):
    """Compact score snapshot used in twin comparisons."""

    overall_score: int
    grade: str
    confidence: float
    confidence_label: str


class CategoryDelta(BaseModel):
    """Per-category score delta."""

    category: str
    before: int
    after: int
    delta: int


class OwnershipTwinResponse(BaseModel):
    """Scenario simulation output."""

    car_id: str
    action: Literal["delay", "do_now"]
    event_type: str
    assumptions: list[str]
    baseline: OwnershipTwinScore
    projected: OwnershipTwinScore
    category_deltas: list[CategoryDelta]
    baseline_urgency: Optional[str] = None
    projected_urgency: Optional[str] = None
    score_delta: int
    risk_change: Literal["improved", "worsened", "stable"]
    explanation_source: Literal["llm", "rule_based"] = "rule_based"
    narrative: str
    projected_recommendations: list[str]
    computed_at: datetime
    scoring_version: str
    projected_as_of: date
