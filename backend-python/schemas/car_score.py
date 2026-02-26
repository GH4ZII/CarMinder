"""
Car care score schemas for the scoring algorithm response.
"""
from datetime import datetime
from typing import List

from pydantic import BaseModel


class CategoryScore(BaseModel):
    """Score for a single scoring category."""

    score: int  # 0-100
    weight: int  # Weight in the overall score (sums to 100)
    label: str  # Human-readable name


class CategoryBreakdown(BaseModel):
    """All category scores."""

    maintenance_regularity: CategoryScore
    eu_inspection: CategoryScore
    incident_history: CategoryScore
    mileage_tracking: CategoryScore
    documentation_quality: CategoryScore


class CarCareScoreResponse(BaseModel):
    """Complete scoring response for a single car."""

    car_id: str
    overall_score: int  # 0-100
    grade: str  # A, B, C, D, F
    confidence: float  # 0.0-1.0
    confidence_label: str  # "very_low", "low", "moderate", "high"
    summary: str
    categories: CategoryBreakdown
    recommendations: List[str]
    computed_at: datetime
