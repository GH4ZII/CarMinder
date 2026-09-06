"""
Pure car-care scoring engine.

Computes a 0-100 score across 5 weighted categories:
  - Maintenance Regularity (40%)
  - EU Inspection Compliance (15%)
  - Incident History & Repairs (20%)
  - Mileage Tracking (10%)
  - Documentation Quality (15%)

Uses a confidence system to dampen scores when data is sparse.

Rules:
  - This module must NOT import repositories, FastAPI, Pydantic schemas,
    or any config module.  It receives all data through function arguments.
  - All time references come through the ``as_of`` parameter; the module
    never calls ``date.today()`` or ``datetime.utcnow()``.
  - Given identical inputs and identical ``as_of``, output is identical.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

from domain.scoring.normalize import (
    CarData,
    IncidentData,
    MaintenanceEventData,
    ServiceInterval,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CATEGORY_WEIGHTS: dict[str, int] = {
    "maintenance_regularity": 40,
    "eu_inspection": 15,
    "incident_history": 20,
    "mileage_tracking": 10,
    "documentation_quality": 15,
}

SERVICE_TYPE_WEIGHTS: dict[str, float] = {
    "oil_change": 0.35,
    "brake_service": 0.25,
    "tire_change": 0.15,
    "inspection": 0.25,
}

SEVERITY_PENALTY: dict[str, int] = {"minor": 5, "moderate": 12, "severe": 25}
REPAIR_CREDIT: dict[str, float] = {
    "fully_repaired": 1.0,
    "partially_repaired": 0.5,
    "not_repaired": 0.0,
}

SCORING_WINDOW_YEARS = 5
TRACKABLE_TYPES = list(SERVICE_TYPE_WEIGHTS.keys())


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class CategoryResult:
    """Score for one scoring category."""

    key: str
    score: int  # 0-100
    weight: int
    label: str


@dataclass(frozen=True, slots=True)
class DetectedIssues:
    """Structured facts the explanation layer needs."""

    unrepaired_count: int
    partially_repaired_count: int


@dataclass(frozen=True, slots=True)
class ScoringResult:
    """Complete output of the scoring engine — no human text."""

    overall_score: int  # 0-100
    grade: str  # A, B, C, D, F
    confidence: float  # 0.0-1.0
    confidence_label: str  # very_low | low | moderate | high
    categories: dict[str, CategoryResult]
    issues: DetectedIssues


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_date(value: Optional[str], fallback: date) -> date:
    """Parse an ISO date string; return *fallback* on any failure."""
    if not value or value == "Unknown":
        return fallback
    try:
        return date.fromisoformat(str(value))
    except (ValueError, TypeError):
        return fallback


def _score_to_grade(score: int) -> str:
    if score >= 90:
        return "A"
    if score >= 75:
        return "B"
    if score >= 60:
        return "C"
    if score >= 40:
        return "D"
    return "F"


def _confidence_label(confidence: float) -> str:
    if confidence < 0.25:
        return "very_low"
    if confidence < 0.50:
        return "low"
    if confidence < 0.75:
        return "moderate"
    return "high"


def _event_sort_key(
    e: MaintenanceEventData,
) -> tuple[date, int, str, str]:
    """Deterministic sort key: (date, mileage, event_type, id)."""
    return (e.event_date, e.mileage or 0, e.event_type, e.id)


def _incident_sort_key(
    i: IncidentData,
) -> tuple[date, int, str, str]:
    """Deterministic sort key for incidents."""
    return (i.incident_date, i.mileage or 0, i.severity, i.id)


# ---------------------------------------------------------------------------
# Confidence
# ---------------------------------------------------------------------------

def _compute_confidence(
    car_age_months: int,
    total_events: int,
    has_mileage: bool,
    has_eu_deadline: bool,
) -> float:
    expected_min_events = max(1, car_age_months // 12)
    event_ratio = min(1.0, total_events / expected_min_events)
    age_factor = min(1.0, car_age_months / 24)

    return min(
        1.0,
        event_ratio * 0.40
        + (0.20 if has_mileage else 0.0)
        + (0.15 if has_eu_deadline else 0.0)
        + age_factor * 0.15
        + 0.10,
    )


# ---------------------------------------------------------------------------
# Category 1 — Maintenance Regularity (weight 40)
# ---------------------------------------------------------------------------

def _score_single_interval(
    prev_date: date,
    prev_mileage: Optional[int],
    next_date: date,
    next_mileage: Optional[int],
    interval_months: Optional[int],
    interval_km: Optional[int],
) -> float:
    """Score one gap between two service events.  Returns 0.0-1.0."""
    scores: list[float] = []

    if interval_months is not None:
        actual = (next_date - prev_date).days / 30.0
        expected = float(interval_months)
        if actual <= expected:
            scores.append(1.0)
        elif actual <= expected * 1.25:
            ratio = (actual - expected) / (expected * 0.25)
            scores.append(1.0 - ratio * 0.3)
        elif actual <= expected * 1.5:
            ratio = (actual - expected * 1.25) / (expected * 0.25)
            scores.append(0.7 - ratio * 0.3)
        elif actual <= expected * 2.0:
            ratio = (actual - expected * 1.5) / (expected * 0.5)
            scores.append(0.4 - ratio * 0.4)
        else:
            scores.append(0.0)

    if interval_km is not None and prev_mileage is not None and next_mileage is not None:
        actual_km = next_mileage - prev_mileage
        expected_km = float(interval_km)
        if actual_km <= expected_km:
            scores.append(1.0)
        elif actual_km <= expected_km * 1.25:
            ratio = (actual_km - expected_km) / (expected_km * 0.25)
            scores.append(1.0 - ratio * 0.3)
        elif actual_km <= expected_km * 1.5:
            ratio = (actual_km - expected_km * 1.25) / (expected_km * 0.25)
            scores.append(0.7 - ratio * 0.3)
        elif actual_km <= expected_km * 2.0:
            ratio = (actual_km - expected_km * 1.5) / (expected_km * 0.5)
            scores.append(0.4 - ratio * 0.4)
        else:
            scores.append(0.0)

    if not scores:
        return 0.5
    return min(scores)


def _recency_weighted_average(scores: list[float]) -> float:
    """Linearly increasing weights so recent intervals matter more."""
    if not scores:
        return 0.5
    if len(scores) == 1:
        return scores[0]
    weights = list(range(1, len(scores) + 1))
    return sum(s * w for s, w in zip(scores, weights)) / sum(weights)


def _score_service_type(
    events: list[MaintenanceEventData],
    window_start: date,
    as_of: date,
    current_km: int,
    interval_months: Optional[int],
    interval_km: Optional[int],
) -> float:
    """Score a single service type across the scoring window.  Returns 0.0-1.0."""
    filtered = [e for e in events if e.event_date >= window_start]
    filtered.sort(key=_event_sort_key)

    if not filtered:
        if interval_months is None and interval_km is None:
            return 1.0
        months_since = (as_of - window_start).days / 30.0
        if interval_months and months_since < interval_months * 0.5:
            return 0.75
        return _score_single_interval(
            window_start, 0, as_of, current_km, interval_months, interval_km
        )

    interval_scores: list[float] = []

    first = filtered[0]
    interval_scores.append(
        _score_single_interval(
            window_start, None, first.event_date, first.mileage,
            interval_months, interval_km,
        )
    )

    for i in range(1, len(filtered)):
        prev = filtered[i - 1]
        curr = filtered[i]
        interval_scores.append(
            _score_single_interval(
                prev.event_date, prev.mileage,
                curr.event_date, curr.mileage,
                interval_months, interval_km,
            )
        )

    last = filtered[-1]
    interval_scores.append(
        _score_single_interval(
            last.event_date, last.mileage,
            as_of, current_km,
            interval_months, interval_km,
        )
    )

    return _recency_weighted_average(interval_scores)


def _compute_maintenance_regularity(
    car: CarData,
    events: list[MaintenanceEventData],
    car_age_months: int,
    as_of: date,
    service_intervals: dict[str, ServiceInterval],
) -> float:
    """Returns 0-100 maintenance regularity score."""
    first_reg = car.first_registration_date or (as_of - timedelta(days=365))
    window_start = max(first_reg, as_of - timedelta(days=365 * SCORING_WINDOW_YEARS))
    current_km = car.current_km

    by_type: dict[str, list[MaintenanceEventData]] = {t: [] for t in TRACKABLE_TYPES}
    for e in events:
        if e.event_type in by_type:
            by_type[e.event_type].append(e)

    weighted_score = 0.0
    for stype, weight in SERVICE_TYPE_WEIGHTS.items():
        interval = service_intervals.get(stype, ServiceInterval(months=None, km=None))
        s = _score_service_type(
            by_type.get(stype, []),
            window_start, as_of, current_km,
            interval.months, interval.km,
        )
        weighted_score += s * weight

    return weighted_score * 100


# ---------------------------------------------------------------------------
# Category 2 — EU Inspection Compliance (weight 15)
# ---------------------------------------------------------------------------

def _compute_eu_inspection(
    eu_deadline: Optional[str],
    inspection_events: list[MaintenanceEventData],
    as_of: date,
) -> float:
    """Returns 0-100 EU inspection score."""

    # --- current status (60%) ---
    if not eu_deadline or eu_deadline == "Unknown":
        current_status = 0.7 if inspection_events else 0.5
    else:
        deadline = _parse_date(eu_deadline, as_of)
        days_until = (deadline - as_of).days
        if days_until < -90:
            current_status = 0.0
        elif days_until < 0:
            current_status = 0.3 * (1.0 - abs(days_until) / 90.0)
        elif days_until <= 30:
            current_status = 0.6
        elif days_until <= 90:
            current_status = 0.85
        else:
            current_status = 1.0

    # --- historical compliance (40%) ---
    sorted_events = sorted(inspection_events, key=_event_sort_key)
    if len(sorted_events) <= 1:
        historical = 0.7 if sorted_events else 0.5
    else:
        gap_scores: list[float] = []
        for i in range(1, len(sorted_events)):
            prev_d = sorted_events[i - 1].event_date
            curr_d = sorted_events[i].event_date
            gap_months = (curr_d - prev_d).days / 30.0
            if gap_months <= 14:
                gap_scores.append(1.0)
            elif gap_months <= 18:
                gap_scores.append(0.6)
            elif gap_months <= 24:
                gap_scores.append(0.3)
            else:
                gap_scores.append(0.0)
        historical = sum(gap_scores) / len(gap_scores)

    return (current_status * 0.6 + historical * 0.4) * 100


# ---------------------------------------------------------------------------
# Category 3 — Incident History & Repair Diligence (weight 20)
# ---------------------------------------------------------------------------

def _compute_incident_score(
    incidents: list[IncidentData],
    car_age_months: int,
) -> float:
    """Returns 0-100 incident score."""
    if not incidents:
        return 100.0 if car_age_months >= 12 else 85.0

    total_penalty = 0.0
    total_recovery = 0.0

    for inc in incidents:
        penalty = SEVERITY_PENALTY.get(inc.severity, 5)
        recovery_factor = REPAIR_CREDIT.get(inc.repair_status, 0.0)
        total_penalty += penalty
        total_recovery += penalty * recovery_factor * 0.7

    age_years = max(1.0, car_age_months / 12.0)
    expected_incidents = age_years * 0.3
    if len(incidents) <= expected_incidents:
        total_penalty *= 0.7

    net = total_penalty - total_recovery
    net = min(net, 80.0)
    return max(0.0, 100.0 - net)


# ---------------------------------------------------------------------------
# Category 4 — Mileage Tracking (weight 10)
# ---------------------------------------------------------------------------

def _compute_mileage_tracking(
    car: CarData,
    events: list[MaintenanceEventData],
    car_age_months: int,
    as_of: date,
) -> float:
    """Returns 0-100 mileage tracking score."""
    current_km = car.current_km
    has_current = current_km > 0

    events_with_mileage = [e for e in events if e.mileage is not None]
    recording_ratio = len(events_with_mileage) / len(events) if events else 0.0

    # consistency — monotonically increasing?
    consistency = 1.0
    if len(events_with_mileage) >= 2:
        sorted_ev = sorted(events_with_mileage, key=_event_sort_key)
        mileages = [e.mileage for e in sorted_ev]  # type: ignore[misc]
        violations = sum(
            1 for i in range(1, len(mileages)) if mileages[i] < mileages[i - 1]
        )
        if violations:
            consistency = max(0.0, 1.0 - violations / len(mileages))

    # reasonableness
    reasonableness = 1.0
    if current_km > 0 and car_age_months > 6:
        km_per_year = (current_km / car_age_months) * 12
        if km_per_year < 1000:
            reasonableness = 0.5
        elif km_per_year > 60000:
            reasonableness = 0.7

    score = (
        (1.0 if has_current else 0.0) * 0.20
        + recording_ratio * 0.50
        + consistency * 0.20
        + reasonableness * 0.10
    )
    return score * 100


# ---------------------------------------------------------------------------
# Category 5 — Documentation Quality (weight 15)
# ---------------------------------------------------------------------------

def _score_event_documentation(event: MaintenanceEventData) -> float:
    pts, mx = 0.0, 0.0

    mx += 3.0
    if event.mileage is not None:
        pts += 3.0

    mx += 2.0
    if event.cost_cents is not None and event.cost_cents > 0:
        pts += 2.0

    mx += 2.0
    if event.vendor:
        pts += 2.0

    mx += 1.5
    notes = event.notes or ""
    if notes:
        pts += 1.5
        if len(notes) > 20:
            pts += 0.5
            mx += 0.5

    mx += 2.0
    if event.receipt_image_url:
        pts += 2.0

    return pts / mx if mx else 0.0


def _score_incident_documentation(incident: IncidentData) -> float:
    pts, mx = 0.0, 0.0

    mx += 2.0
    if incident.damage_description:
        pts += 2.0

    mx += 2.0
    if incident.mileage is not None:
        pts += 2.0

    if incident.repair_status != "not_repaired":
        mx += 1.5
        if incident.repair_cost_cents is not None and incident.repair_cost_cents > 0:
            pts += 1.5
        mx += 1.5
        if incident.repair_vendor:
            pts += 1.5

    mx += 1.0
    pts += 1.0  # insurance_claim is always set (boolean)

    return pts / mx if mx else 0.0


def _compute_documentation_quality(
    events: list[MaintenanceEventData],
    incidents: list[IncidentData],
    car_age_months: int,
) -> float:
    """Returns 0-100 documentation quality score."""
    maint_scores = [_score_event_documentation(e) for e in events]
    inc_scores = [_score_incident_documentation(i) for i in incidents]

    if not maint_scores and not inc_scores:
        return 60.0 if car_age_months < 6 else 30.0

    avg_maint = sum(maint_scores) / len(maint_scores) if maint_scores else 0.5
    avg_inc = sum(inc_scores) / len(inc_scores) if inc_scores else 0.5

    if maint_scores and inc_scores:
        combined = avg_maint * 0.70 + avg_inc * 0.30
    elif maint_scores:
        combined = avg_maint
    else:
        combined = avg_inc

    total_records = len(maint_scores) + len(inc_scores)
    expected_annual = 4
    expected = max(1, (car_age_months / 12) * expected_annual)
    volume_ratio = min(1.0, total_records / expected)
    volume_bonus = volume_ratio * 10

    return min(100.0, combined * 90 + volume_bonus)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def compute_score(
    car: CarData,
    events: list[MaintenanceEventData],
    incidents: list[IncidentData],
    as_of: date,
    service_intervals: dict[str, ServiceInterval],
) -> ScoringResult:
    """
    Compute the full car-care score.

    All inputs must already be normalized (canonical enum values, parsed
    dates).  ``as_of`` controls the reference date for every time-based 
    calculation.
    """
    # 1. Car age
    first_reg = car.first_registration_date or (as_of - timedelta(days=365))
    car_age_months = max(1, (as_of - first_reg).days // 30)

    # 2. Confidence
    has_eu = bool(car.eu_deadline) and car.eu_deadline != "Unknown"
    confidence = _compute_confidence(
        car_age_months=car_age_months,
        total_events=len(events),
        has_mileage=car.current_km > 0,
        has_eu_deadline=has_eu,
    )

    # 3. Category scores (each 0-100)
    cat_maint = _compute_maintenance_regularity(
        car, events, car_age_months, as_of, service_intervals,
    )
    cat_eu = _compute_eu_inspection(
        car.eu_deadline,
        [e for e in events if e.event_type == "inspection"],
        as_of,
    )
    cat_incident = _compute_incident_score(incidents, car_age_months)
    cat_mileage = _compute_mileage_tracking(car, events, car_age_months, as_of)
    cat_docs = _compute_documentation_quality(events, incidents, car_age_months)

    # 4. Weighted sum
    raw = (
        cat_maint * CATEGORY_WEIGHTS["maintenance_regularity"]
        + cat_eu * CATEGORY_WEIGHTS["eu_inspection"]
        + cat_incident * CATEGORY_WEIGHTS["incident_history"]
        + cat_mileage * CATEGORY_WEIGHTS["mileage_tracking"]
        + cat_docs * CATEGORY_WEIGHTS["documentation_quality"]
    ) / 100

    # 5. Confidence dampening
    if confidence < 0.5:
        factor = confidence / 0.5
        dampened = raw * factor + 50 * (1 - factor)
    else:
        dampened = raw

    final_score = int(round(max(0, min(100, dampened))))
    grade = _score_to_grade(final_score)

    # 6. Detected issues (structured facts for explanation layer)
    issues = DetectedIssues(
        unrepaired_count=sum(
            1 for i in incidents if i.repair_status == "not_repaired"
        ),
        partially_repaired_count=sum(
            1 for i in incidents if i.repair_status == "partially_repaired"
        ),
    )

    # 7. Build result
    categories = {
        "maintenance_regularity": CategoryResult(
            key="maintenance_regularity",
            score=int(round(cat_maint)),
            weight=CATEGORY_WEIGHTS["maintenance_regularity"],
            label="Maintenance Regularity",
        ),
        "eu_inspection": CategoryResult(
            key="eu_inspection",
            score=int(round(cat_eu)),
            weight=CATEGORY_WEIGHTS["eu_inspection"],
            label="EU Inspection Compliance",
        ),
        "incident_history": CategoryResult(
            key="incident_history",
            score=int(round(cat_incident)),
            weight=CATEGORY_WEIGHTS["incident_history"],
            label="Incident History & Repairs",
        ),
        "mileage_tracking": CategoryResult(
            key="mileage_tracking",
            score=int(round(cat_mileage)),
            weight=CATEGORY_WEIGHTS["mileage_tracking"],
            label="Mileage Tracking",
        ),
        "documentation_quality": CategoryResult(
            key="documentation_quality",
            score=int(round(cat_docs)),
            weight=CATEGORY_WEIGHTS["documentation_quality"],
            label="Documentation Quality",
        ),
    }

    return ScoringResult(
        overall_score=final_score,
        grade=grade,
        confidence=round(confidence, 2),
        confidence_label=_confidence_label(confidence),
        categories=categories,
        issues=issues,
    )
