"""
Scoring service orchestrator.

Thin layer that:
  1. Fetches raw data from repositories.
  2. Normalizes it into canonical dataclasses.
  3. Calls the pure scoring engine.
  4. Generates human-readable explanations.
  5. Maps everything into the Pydantic response DTO.
"""
from datetime import date, datetime

from domain.scoring.engine import compute_score
from domain.scoring.normalize import (
    normalize_car,
    normalize_event,
    normalize_incident,
    normalize_intervals,
)
from exceptions import NotFoundError
from repositories import car_repository, incident_repository, maintenance_repository
from schemas.car_score import (
    CarCareScoreResponse,
    CategoryBreakdown,
    CategoryScore,
)
from schemas.service_interval import DEFAULT_INTERVALS
from services.scoring_explain import generate_recommendations, generate_summary

SCORING_VERSION = "1.0.0"


def compute_car_care_score(uid: str, car_id: str) -> CarCareScoreResponse:
    """Compute the full car care score for a single car."""

    # 1. Fetch raw data from repositories ------------------------------------
    raw_car = car_repository.get_car_by_id_and_user(car_id, uid)
    if not raw_car:
        raise NotFoundError("Car not found")

    raw_events = maintenance_repository.list_events_for_car(car_id)
    raw_incidents = incident_repository.list_incidents_for_car(car_id)

    # 2. Fix the reference date once -----------------------------------------
    as_of = date.today()

    # 3. Normalize into canonical types --------------------------------------
    car = normalize_car(raw_car)
    events = [normalize_event(e, fallback_date=as_of) for e in raw_events]
    incidents = [normalize_incident(i, fallback_date=as_of) for i in raw_incidents]
    intervals = normalize_intervals(DEFAULT_INTERVALS)

    # 4. Run the pure scoring engine -----------------------------------------
    result = compute_score(car, events, incidents, as_of, intervals)

    # 5. Generate human-readable text ----------------------------------------
    recommendations = generate_recommendations(result)
    summary = generate_summary(result, car)

    # 6. Map engine result → response DTO ------------------------------------
    cats = result.categories
    return CarCareScoreResponse(
        car_id=car_id,
        overall_score=result.overall_score,
        grade=result.grade,
        confidence=result.confidence,
        confidence_label=result.confidence_label,
        summary=summary,
        categories=CategoryBreakdown(
            maintenance_regularity=CategoryScore(
                score=cats["maintenance_regularity"].score,
                weight=cats["maintenance_regularity"].weight,
                label=cats["maintenance_regularity"].label,
            ),
            eu_inspection=CategoryScore(
                score=cats["eu_inspection"].score,
                weight=cats["eu_inspection"].weight,
                label=cats["eu_inspection"].label,
            ),
            incident_history=CategoryScore(
                score=cats["incident_history"].score,
                weight=cats["incident_history"].weight,
                label=cats["incident_history"].label,
            ),
            mileage_tracking=CategoryScore(
                score=cats["mileage_tracking"].score,
                weight=cats["mileage_tracking"].weight,
                label=cats["mileage_tracking"].label,
            ),
            documentation_quality=CategoryScore(
                score=cats["documentation_quality"].score,
                weight=cats["documentation_quality"].weight,
                label=cats["documentation_quality"].label,
            ),
        ),
        recommendations=recommendations,
        computed_at=datetime.utcnow(),
        scoring_version=SCORING_VERSION,
        scored_as_of=as_of,
    )
