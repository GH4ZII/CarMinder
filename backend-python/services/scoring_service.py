"""
Car care scoring algorithm.

Computes a 0-100 score across 5 weighted categories:
  - Maintenance Regularity (40%)
  - EU Inspection Compliance (15%)
  - Incident History & Repairs (20%)
  - Mileage Tracking (10%)
  - Documentation Quality (15%)

Uses a confidence system to dampen scores when data is sparse.
"""
from datetime import date, datetime, timedelta
from typing import Any, Optional

from exceptions import NotFoundError
from repositories import car_repository, incident_repository, maintenance_repository
from schemas.car_score import (
    CarCareScoreResponse,
    CategoryBreakdown,
    CategoryScore,
)
from schemas.service_interval import DEFAULT_INTERVALS

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CATEGORY_WEIGHTS = {
    "maintenance_regularity": 40,
    "eu_inspection": 15,
    "incident_history": 20,
    "mileage_tracking": 10,
    "documentation_quality": 15,
}

SERVICE_TYPE_WEIGHTS = {
    "oil_change": 0.35,
    "brake_service": 0.25,
    "tire_change": 0.15,
    "inspection": 0.25,
}

SEVERITY_PENALTY = {"minor": 5, "moderate": 12, "severe": 25}
REPAIR_CREDIT = {"fully_repaired": 1.0, "partially_repaired": 0.5, "not_repaired": 0.0}

GRADE_DESCRIPTIONS = {
    "A": "Excellent care",
    "B": "Good care",
    "C": "Fair care",
    "D": "Below average care",
    "F": "Poor care",
}

SCORING_WINDOW_YEARS = 5
TRACKABLE_TYPES = ["oil_change", "brake_service", "tire_change", "inspection"]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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


def _parse_date(value: Any, fallback: date) -> date:
    """Safely parse an ISO date string, returning *fallback* on failure."""
    if not value or value == "Unknown":
        return fallback
    try:
        return date.fromisoformat(str(value))
    except (ValueError, TypeError):
        return fallback


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
        + 0.10,  # baseline for incident data presence
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
    """Score one gap between two service events. Returns 0.0–1.0."""
    scores: list[float] = []

    # --- time-based ---
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

    # --- mileage-based ---
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
        return 0.5  # no data to evaluate
    return min(scores)  # worst of time / mileage


def _recency_weighted_average(scores: list[float]) -> float:
    """Linearly increasing weights so recent intervals matter more."""
    if not scores:
        return 0.5
    if len(scores) == 1:
        return scores[0]
    weights = list(range(1, len(scores) + 1))
    return sum(s * w for s, w in zip(scores, weights)) / sum(weights)


def _score_service_type(
    events: list[dict[str, Any]],
    window_start: date,
    today: date,
    current_km: int,
    interval_months: Optional[int],
    interval_km: Optional[int],
) -> float:
    """Score a single service type across the scoring window. Returns 0.0–1.0."""

    # Filter & sort events within window
    filtered = [
        e
        for e in events
        if _parse_date(e.get("event_date"), today) >= window_start
    ]
    filtered.sort(key=lambda e: e.get("event_date", ""))

    # --- "never done" case ---
    if not filtered:
        if interval_months is None and interval_km is None:
            return 1.0  # no schedule, no penalty
        months_since = (today - window_start).days / 30.0
        if interval_months and months_since < interval_months * 0.5:
            return 0.75  # car too new to judge harshly
        # treat entire window as one missed interval
        return _score_single_interval(
            window_start, 0, today, current_km, interval_months, interval_km
        )

    # --- score each consecutive gap ---
    interval_scores: list[float] = []

    # gap: window_start → first event
    first = filtered[0]
    interval_scores.append(
        _score_single_interval(
            window_start,
            None,
            _parse_date(first.get("event_date"), today),
            first.get("mileage"),
            interval_months,
            interval_km,
        )
    )

    # gaps between consecutive events
    for i in range(1, len(filtered)):
        prev = filtered[i - 1]
        curr = filtered[i]
        interval_scores.append(
            _score_single_interval(
                _parse_date(prev.get("event_date"), today),
                prev.get("mileage"),
                _parse_date(curr.get("event_date"), today),
                curr.get("mileage"),
                interval_months,
                interval_km,
            )
        )

    # open interval: last event → today
    last = filtered[-1]
    interval_scores.append(
        _score_single_interval(
            _parse_date(last.get("event_date"), today),
            last.get("mileage"),
            today,
            current_km,
            interval_months,
            interval_km,
        )
    )

    return _recency_weighted_average(interval_scores)


def _compute_maintenance_regularity(
    car: dict[str, Any],
    events: list[dict[str, Any]],
    car_age_months: int,
) -> float:
    """Returns 0–100 maintenance regularity score."""
    today = date.today()
    first_reg = _parse_date(car.get("forstegangregistrert"), today - timedelta(days=365))
    window_start = max(first_reg, today - timedelta(days=365 * SCORING_WINDOW_YEARS))
    current_km = car.get("kilometer", 0) or 0

    # group events by type
    by_type: dict[str, list[dict[str, Any]]] = {t: [] for t in TRACKABLE_TYPES}
    for e in events:
        et = e.get("event_type", "")
        if et in by_type:
            by_type[et].append(e)

    weighted_score = 0.0
    for stype, weight in SERVICE_TYPE_WEIGHTS.items():
        intervals = DEFAULT_INTERVALS.get(stype, {})
        s = _score_service_type(
            by_type.get(stype, []),
            window_start,
            today,
            current_km,
            intervals.get("months"),
            intervals.get("km"),
        )
        weighted_score += s * weight

    return weighted_score * 100


# ---------------------------------------------------------------------------
# Category 2 — EU Inspection Compliance (weight 15)
# ---------------------------------------------------------------------------


def _compute_eu_inspection(
    eukontrollfrist: Optional[str],
    inspection_events: list[dict[str, Any]],
) -> float:
    """Returns 0–100 EU inspection score."""
    today = date.today()

    # --- current status (60%) ---
    if not eukontrollfrist or eukontrollfrist == "Unknown":
        current_status = 0.7 if inspection_events else 0.5
    else:
        try:
            deadline = date.fromisoformat(eukontrollfrist)
        except (ValueError, TypeError):
            current_status = 0.5
            deadline = None
        else:
            days_until = (deadline - today).days
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
    sorted_events = sorted(inspection_events, key=lambda e: e.get("event_date", ""))
    if len(sorted_events) <= 1:
        historical = 0.7 if sorted_events else 0.5
    else:
        gap_scores: list[float] = []
        for i in range(1, len(sorted_events)):
            prev_d = _parse_date(sorted_events[i - 1].get("event_date"), today)
            curr_d = _parse_date(sorted_events[i].get("event_date"), today)
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
    incidents: list[dict[str, Any]],
    car_age_months: int,
) -> float:
    """Returns 0–100 incident score."""
    if not incidents:
        return 100.0 if car_age_months >= 12 else 85.0

    total_penalty = 0.0
    total_recovery = 0.0

    for inc in incidents:
        severity = inc.get("severity", "minor")
        repair_status = inc.get("repair_status", "not_repaired")
        penalty = SEVERITY_PENALTY.get(severity, 5)
        recovery_factor = REPAIR_CREDIT.get(repair_status, 0.0)
        total_penalty += penalty
        total_recovery += penalty * recovery_factor * 0.7

    # age-normalization
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
    car: dict[str, Any],
    events: list[dict[str, Any]],
    car_age_months: int,
) -> float:
    """Returns 0–100 mileage tracking score."""
    current_km = car.get("kilometer", 0) or 0
    has_current = current_km > 0

    # mileage recording ratio on events
    events_with_mileage = [e for e in events if e.get("mileage") is not None]
    recording_ratio = len(events_with_mileage) / len(events) if events else 0.0

    # consistency — monotonically increasing?
    consistency = 1.0
    if len(events_with_mileage) >= 2:
        sorted_ev = sorted(events_with_mileage, key=lambda e: e.get("event_date", ""))
        mileages = [e["mileage"] for e in sorted_ev]
        violations = sum(1 for i in range(1, len(mileages)) if mileages[i] < mileages[i - 1])
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


def _score_event_documentation(event: dict[str, Any]) -> float:
    pts, mx = 0.0, 0.0

    mx += 3.0
    if event.get("mileage") is not None:
        pts += 3.0

    mx += 2.0
    if event.get("cost_cents") is not None and event["cost_cents"] > 0:
        pts += 2.0

    mx += 2.0
    if event.get("vendor") and str(event["vendor"]).strip():
        pts += 2.0

    mx += 1.5
    notes = event.get("notes") or ""
    if notes.strip():
        pts += 1.5
        if len(notes.strip()) > 20:
            pts += 0.5
            mx += 0.5

    mx += 2.0
    if event.get("receipt_image_url") and str(event["receipt_image_url"]).strip():
        pts += 2.0

    return pts / mx if mx else 0.0


def _score_incident_documentation(incident: dict[str, Any]) -> float:
    pts, mx = 0.0, 0.0

    mx += 2.0
    if incident.get("damage_description") and str(incident["damage_description"]).strip():
        pts += 2.0

    mx += 2.0
    if incident.get("mileage") is not None:
        pts += 2.0

    repair_status = incident.get("repair_status", "not_repaired")
    if repair_status != "not_repaired":
        mx += 1.5
        if incident.get("repair_cost_cents") is not None and incident["repair_cost_cents"] > 0:
            pts += 1.5
        mx += 1.5
        if incident.get("repair_vendor") and str(incident["repair_vendor"]).strip():
            pts += 1.5

    mx += 1.0
    pts += 1.0  # insurance_claim is always set (boolean)

    return pts / mx if mx else 0.0


def _compute_documentation_quality(
    events: list[dict[str, Any]],
    incidents: list[dict[str, Any]],
    car_age_months: int,
) -> float:
    """Returns 0–100 documentation quality score."""
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

    # volume bonus
    total_records = len(maint_scores) + len(inc_scores)
    expected_annual = 4
    expected = max(1, (car_age_months / 12) * expected_annual)
    volume_ratio = min(1.0, total_records / expected)
    volume_bonus = volume_ratio * 10

    return min(100.0, combined * 90 + volume_bonus)


# ---------------------------------------------------------------------------
# Recommendations
# ---------------------------------------------------------------------------


def _generate_recommendations(
    cat_maint: float,
    cat_eu: float,
    cat_incident: float,
    cat_mileage: float,
    cat_docs: float,
    incidents: list[dict[str, Any]],
) -> list[str]:
    recs: list[str] = []

    if cat_maint < 50:
        recs.append(
            "Your maintenance schedule has significant gaps. Consider setting "
            "reminders for oil changes, brake service, and tire rotations."
        )
    elif cat_maint < 75:
        recs.append(
            "Some maintenance services are overdue. Check your service intervals "
            "dashboard for upcoming due dates."
        )

    if cat_eu < 50:
        recs.append(
            "Your EU inspection (EU-kontroll) is overdue or has gaps. "
            "Schedule an inspection as soon as possible."
        )
    elif cat_eu < 75:
        recs.append(
            "Your EU inspection deadline is approaching. Plan ahead to book "
            "an appointment."
        )

    unrepaired = [i for i in incidents if i.get("repair_status") == "not_repaired"]
    partially = [i for i in incidents if i.get("repair_status") == "partially_repaired"]
    if unrepaired:
        recs.append(
            f"You have {len(unrepaired)} unrepaired incident(s). Completing "
            "repairs will improve your car care score."
        )
    if partially:
        recs.append(
            f"You have {len(partially)} partially repaired incident(s). "
            "Completing the repairs will improve your score."
        )

    if cat_mileage < 50:
        recs.append(
            "Update your car's mileage regularly and include mileage when "
            "logging maintenance events for better tracking accuracy."
        )

    if cat_docs < 50:
        recs.append(
            "Improve your records by adding cost, vendor, and notes when "
            "logging maintenance. Upload receipts for better documentation."
        )
    elif cat_docs < 75:
        recs.append(
            "Consider uploading receipts and adding vendor details to your "
            "maintenance logs for more complete records."
        )

    if not recs:
        recs.append(
            "Great job maintaining your vehicle! Keep up the regular "
            "maintenance schedule."
        )

    return recs[:5]


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------


def _generate_summary(
    score: int,
    grade: str,
    confidence: float,
    car: dict[str, Any],
) -> str:
    car_name = f"{car.get('merke', '')} {car.get('modell', '')}".strip() or "Your car"
    desc = GRADE_DESCRIPTIONS.get(grade, "")

    if confidence < 0.3:
        qualifier = "Based on limited data available, "
    elif confidence < 0.6:
        qualifier = "Based on the data recorded so far, "
    else:
        qualifier = ""

    return f"{qualifier}{car_name} receives a care grade of {grade} ({desc}). Overall score: {score}/100."


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def compute_car_care_score(uid: str, car_id: str) -> CarCareScoreResponse:
    """Compute the full car care score for a single car."""

    # 1. Fetch data ---------------------------------------------------------
    car = car_repository.get_car_by_id_and_user(car_id, uid)
    if not car:
        raise NotFoundError("Car not found")

    events = maintenance_repository.list_events_for_car(car_id)
    incidents = incident_repository.list_incidents_for_car(car_id)
    today = date.today()

    # 2. Car age ------------------------------------------------------------
    first_reg = _parse_date(car.get("forstegangregistrert"), today - timedelta(days=365))
    car_age_months = max(1, (today - first_reg).days // 30)

    # 3. Confidence ---------------------------------------------------------
    current_km = car.get("kilometer", 0) or 0
    eu_frist = car.get("eukontrollfrist")
    has_eu = bool(eu_frist) and eu_frist != "Unknown"

    confidence = _compute_confidence(
        car_age_months=car_age_months,
        total_events=len(events),
        has_mileage=current_km > 0,
        has_eu_deadline=has_eu,
    )

    # 4. Category scores (each 0–100) --------------------------------------
    cat_maint = _compute_maintenance_regularity(car, events, car_age_months)
    cat_eu = _compute_eu_inspection(
        eu_frist,
        [e for e in events if e.get("event_type") == "inspection"],
    )
    cat_incident = _compute_incident_score(incidents, car_age_months)
    cat_mileage = _compute_mileage_tracking(car, events, car_age_months)
    cat_docs = _compute_documentation_quality(events, incidents, car_age_months)

    # 5. Weighted sum -------------------------------------------------------
    raw = (
        cat_maint * CATEGORY_WEIGHTS["maintenance_regularity"]
        + cat_eu * CATEGORY_WEIGHTS["eu_inspection"]
        + cat_incident * CATEGORY_WEIGHTS["incident_history"]
        + cat_mileage * CATEGORY_WEIGHTS["mileage_tracking"]
        + cat_docs * CATEGORY_WEIGHTS["documentation_quality"]
    ) / 100

    # 6. Confidence dampening -----------------------------------------------
    if confidence < 0.5:
        factor = confidence / 0.5
        dampened = raw * factor + 50 * (1 - factor)
    else:
        dampened = raw

    final_score = int(round(max(0, min(100, dampened))))
    grade = _score_to_grade(final_score)

    # 7. Recommendations & summary ------------------------------------------
    recommendations = _generate_recommendations(
        cat_maint, cat_eu, cat_incident, cat_mileage, cat_docs, incidents
    )
    summary = _generate_summary(final_score, grade, confidence, car)

    # 8. Build response -----------------------------------------------------
    return CarCareScoreResponse(
        car_id=car_id,
        overall_score=final_score,
        grade=grade,
        confidence=round(confidence, 2),
        confidence_label=_confidence_label(confidence),
        summary=summary,
        categories=CategoryBreakdown(
            maintenance_regularity=CategoryScore(
                score=int(round(cat_maint)),
                weight=CATEGORY_WEIGHTS["maintenance_regularity"],
                label="Maintenance Regularity",
            ),
            eu_inspection=CategoryScore(
                score=int(round(cat_eu)),
                weight=CATEGORY_WEIGHTS["eu_inspection"],
                label="EU Inspection Compliance",
            ),
            incident_history=CategoryScore(
                score=int(round(cat_incident)),
                weight=CATEGORY_WEIGHTS["incident_history"],
                label="Incident History & Repairs",
            ),
            mileage_tracking=CategoryScore(
                score=int(round(cat_mileage)),
                weight=CATEGORY_WEIGHTS["mileage_tracking"],
                label="Mileage Tracking",
            ),
            documentation_quality=CategoryScore(
                score=int(round(cat_docs)),
                weight=CATEGORY_WEIGHTS["documentation_quality"],
                label="Documentation Quality",
            ),
        ),
        recommendations=recommendations,
        computed_at=datetime.utcnow(),
    )
