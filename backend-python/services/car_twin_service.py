"""
Ownership twin service.

Implements scenario simulation on top of the deterministic scoring engine.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from exceptions import NotFoundError, ValidationError
from repositories import car_repository, incident_repository, maintenance_repository
from schemas.car_twin import (
    CategoryDelta,
    OwnershipTwinRequest,
    OwnershipTwinResponse,
    OwnershipTwinScore,
)
from schemas.service_interval import DEFAULT_INTERVALS
from services.car_twin_explain import generate_twin_explanation
from services import scoring_service


def simulate_ownership_twin(
    uid: str, car_id: str, payload: OwnershipTwinRequest
) -> OwnershipTwinResponse:
    """Simulate a what-if scenario for one car."""
    raw_car = car_repository.get_car_by_id_and_user(car_id, uid)
    if not raw_car:
        raise NotFoundError("Car not found")

    raw_events = maintenance_repository.list_events_for_car(car_id)
    raw_incidents = incident_repository.list_incidents_for_car(car_id)
    as_of = date.today()

    baseline = scoring_service.compute_car_care_score_from_snapshot(
        raw_car=raw_car,
        raw_events=raw_events,
        raw_incidents=raw_incidents,
        as_of=as_of,
    )

    projected_car = dict(raw_car)
    projected_events = [dict(e) for e in raw_events]
    projected_as_of = as_of
    assumptions: list[str] = []

    if payload.action == "delay":
        projected_as_of = as_of + timedelta(days=payload.delay_days)
        current_km = int(raw_car.get("kilometer") or 0)
        extra_km = int(round((payload.monthly_km / 30.0) * payload.delay_days))
        projected_car["kilometer"] = max(0, current_km + extra_km)
        assumptions.append(f"Service is delayed by {payload.delay_days} days.")
        assumptions.append(
            f"Mileage is projected at +{extra_km} km ({payload.monthly_km} km/month pace)."
        )
    elif payload.action == "do_now":
        current_km = int(raw_car.get("kilometer") or 0)
        projected_events.append(
            {
                "id": f"sim_{payload.event_type}_{int(datetime.now(timezone.utc).timestamp())}",
                "car_id": car_id,
                "event_type": payload.event_type,
                "event_date": as_of.isoformat(),
                "mileage": current_km,
                "cost_cents": None,
                "vendor": "Simulation",
                "notes": "Ownership Twin simulated service-now event",
                "receipt_image_url": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        assumptions.append("Service is assumed completed today.")

        # Inspection urgency is deadline-driven in this system.
        if payload.event_type == "inspection":
            projected_car["eukontrollfrist"] = (as_of + timedelta(days=365)).isoformat()
            assumptions.append("EU inspection deadline is assumed extended by 12 months.")
    else:
        raise ValidationError("Unsupported action")

    projected = scoring_service.compute_car_care_score_from_snapshot(
        raw_car=projected_car,
        raw_events=projected_events,
        raw_incidents=raw_incidents,
        as_of=projected_as_of,
    )

    baseline_urgency = _compute_event_urgency(
        event_type=payload.event_type,
        raw_car=raw_car,
        raw_events=raw_events,
        as_of=as_of,
        current_mileage=int(raw_car.get("kilometer") or 0),
    )
    projected_urgency = _compute_event_urgency(
        event_type=payload.event_type,
        raw_car=projected_car,
        raw_events=projected_events,
        as_of=projected_as_of,
        current_mileage=int(projected_car.get("kilometer") or 0),
    )

    score_delta = projected.overall_score - baseline.overall_score
    if score_delta > 0:
        risk_change = "improved"
    elif score_delta < 0:
        risk_change = "worsened"
    else:
        risk_change = "stable"

    category_deltas = _build_category_deltas(baseline, projected)
    fallback_narrative = _build_narrative(
        payload.action,
        payload.event_type,
        baseline.overall_score,
        projected.overall_score,
        baseline_urgency,
        projected_urgency,
    )
    narrative, recommendations, explanation_source = generate_twin_explanation(
        car_name=f"{raw_car.get('merke', '')} {raw_car.get('modell', '')}".strip() or "Your car",
        action=payload.action,
        event_type=payload.event_type,
        assumptions=assumptions,
        baseline_score=baseline.overall_score,
        projected_score=projected.overall_score,
        baseline_grade=baseline.grade,
        projected_grade=projected.grade,
        baseline_urgency=baseline_urgency,
        projected_urgency=projected_urgency,
        category_deltas=[
            {"category": d.category, "before": d.before, "after": d.after, "delta": d.delta}
            for d in category_deltas
        ],
        default_recommendations=projected.recommendations,
        fallback_narrative=fallback_narrative,
    )

    return OwnershipTwinResponse(
        car_id=car_id,
        action=payload.action,
        event_type=payload.event_type,
        assumptions=assumptions,
        baseline=OwnershipTwinScore(
            overall_score=baseline.overall_score,
            grade=baseline.grade,
            confidence=baseline.confidence,
            confidence_label=baseline.confidence_label,
        ),
        projected=OwnershipTwinScore(
            overall_score=projected.overall_score,
            grade=projected.grade,
            confidence=projected.confidence,
            confidence_label=projected.confidence_label,
        ),
        category_deltas=category_deltas,
        baseline_urgency=baseline_urgency,
        projected_urgency=projected_urgency,
        score_delta=score_delta,
        risk_change=risk_change,
        explanation_source=explanation_source,
        narrative=narrative,
        projected_recommendations=recommendations,
        computed_at=datetime.now(timezone.utc),
        scoring_version=scoring_service.SCORING_VERSION,
        projected_as_of=projected_as_of,
    )


def _build_category_deltas(baseline: Any, projected: Any) -> list[CategoryDelta]:
    out: list[CategoryDelta] = []
    for key in [
        "maintenance_regularity",
        "eu_inspection",
        "incident_history",
        "mileage_tracking",
        "documentation_quality",
    ]:
        before = getattr(baseline.categories, key).score
        after = getattr(projected.categories, key).score
        out.append(CategoryDelta(category=key, before=before, after=after, delta=after - before))
    return out


def _build_narrative(
    action: str,
    event_type: str,
    baseline_score: int,
    projected_score: int,
    baseline_urgency: Optional[str],
    projected_urgency: Optional[str],
) -> str:
    delta = projected_score - baseline_score
    direction = "improves" if delta > 0 else "reduces" if delta < 0 else "keeps"
    abs_delta = abs(delta)
    urgency_note = ""
    if baseline_urgency or projected_urgency:
        urgency_note = (
            f" Urgency for {event_type} changes from "
            f"{baseline_urgency or 'unknown'} to {projected_urgency or 'unknown'}."
        )
    if action == "delay":
        return (
            f"Delaying {event_type} {direction} your projected care score by "
            f"{abs_delta} points ({baseline_score} -> {projected_score}).{urgency_note}"
        )
    return (
        f"Completing {event_type} now {direction} your projected care score by "
        f"{abs_delta} points ({baseline_score} -> {projected_score}).{urgency_note}"
    )


def _parse_date(value: Any) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _latest_event(raw_events: list[dict[str, Any]], event_type: str) -> Optional[dict[str, Any]]:
    candidates = [e for e in raw_events if str(e.get("event_type", "")).lower() == event_type]
    if not candidates:
        return None
    candidates.sort(key=lambda e: str(e.get("event_date", "")), reverse=True)
    return candidates[0]


def _compute_event_urgency(
    event_type: str,
    raw_car: dict[str, Any],
    raw_events: list[dict[str, Any]],
    as_of: date,
    current_mileage: int,
) -> str:
    """Compute urgency for one event type with explicit as_of."""
    last = _latest_event(raw_events, event_type)
    interval = DEFAULT_INTERVALS.get(event_type, {"km": None, "months": None})
    interval_km = interval.get("km")
    interval_months = interval.get("months")

    if event_type == "inspection":
        due = _parse_date(raw_car.get("eukontrollfrist"))
        if due is None:
            return "unknown"
        days_until = (due - as_of).days
        if days_until < 0:
            return "overdue"
        if days_until <= 30:
            return "soon"
        return "ok"

    if interval_km is None and interval_months is None:
        return "ok"

    if not last:
        return "unknown"

    last_date = _parse_date(last.get("event_date"))
    last_mileage = last.get("mileage")
    if last_date is None and last_mileage is None:
        return "unknown"

    days_until: Optional[int] = None
    km_until: Optional[int] = None
    if last_date and interval_months is not None:
        due_date = last_date + timedelta(days=interval_months * 30)
        days_until = (due_date - as_of).days
    if isinstance(last_mileage, int) and interval_km is not None:
        due_mileage = last_mileage + interval_km
        km_until = due_mileage - current_mileage

    if (days_until is not None and days_until < 0) or (km_until is not None and km_until < 0):
        return "overdue"
    if (days_until is not None and days_until <= 30) or (km_until is not None and km_until <= 1000):
        return "soon"
    return "ok"
