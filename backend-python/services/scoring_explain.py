"""
Human-readable explanation layer for scoring results.

Converts structured scoring facts (category scores, detected issues)
into recommendation strings and a summary.  Kept separate from the
numeric scoring engine so text can evolve independently.
"""
from __future__ import annotations

from domain.scoring.engine import DetectedIssues, ScoringResult
from domain.scoring.normalize import CarData

GRADE_DESCRIPTIONS: dict[str, str] = {
    "A": "Excellent care",
    "B": "Good care",
    "C": "Fair care",
    "D": "Below average care",
    "F": "Poor care",
}

MAX_RECOMMENDATIONS = 5


def generate_recommendations(result: ScoringResult) -> list[str]:
    """Produce up to 5 actionable recommendation strings."""
    recs: list[str] = []
    cats = result.categories
    issues = result.issues

    cat_maint = cats["maintenance_regularity"].score
    cat_eu = cats["eu_inspection"].score
    cat_mileage = cats["mileage_tracking"].score
    cat_docs = cats["documentation_quality"].score

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

    if issues.unrepaired_count:
        recs.append(
            f"You have {issues.unrepaired_count} unrepaired incident(s). Completing "
            "repairs will improve your car care score."
        )
    if issues.partially_repaired_count:
        recs.append(
            f"You have {issues.partially_repaired_count} partially repaired incident(s). "
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

    return recs[:MAX_RECOMMENDATIONS]


def generate_summary(
    result: ScoringResult,
    car: CarData,
) -> str:
    """Produce a single-sentence human summary of the score."""
    car_name = f"{car.brand} {car.model}".strip() or "Your car"
    desc = GRADE_DESCRIPTIONS.get(result.grade, "")

    if result.confidence < 0.3:
        qualifier = "Based on limited data available, "
    elif result.confidence < 0.6:
        qualifier = "Based on the data recorded so far, "
    else:
        qualifier = ""

    return (
        f"{qualifier}{car_name} receives a care grade of "
        f"{result.grade} ({desc}). Overall score: {result.overall_score}/100."
    )
