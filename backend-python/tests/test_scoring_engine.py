"""
Tests for the car care scoring engine.

Validates two properties:
  1. Determinism — identical inputs always produce identical output.
  2. Metamorphic relations — logical relationships between inputs and
     outputs that must hold regardless of exact score values.

These tests run without a database, running server, or any FastAPI
dependency, which itself demonstrates the domain module's isolation
from infrastructure concerns.
"""
import inspect
from datetime import date

import pytest

from domain.scoring.engine import compute_score
from domain.scoring.normalize import (
    CarData,
    IncidentData,
    MaintenanceEventData,
    ServiceInterval,
)

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

REFERENCE_DATE = date(2026, 3, 1)

DEFAULT_INTERVALS: dict[str, ServiceInterval] = {
    "oil_change":    ServiceInterval(months=12, km=15000),
    "brake_service": ServiceInterval(months=24, km=30000),
    "tire_change":   ServiceInterval(months=24, km=30000),
    "inspection":    ServiceInterval(months=24, km=None),
}

BASE_CAR = CarData(
    first_registration_date=date(2020, 1, 1),
    current_km=50000,
    eu_deadline="2027-01-01",
    brand="MAZDA",
    model="3",
)

EMPTY_CAR = CarData(
    first_registration_date=date(2023, 1, 1),
    current_km=0,
    eu_deadline=None,
    brand="TEST",
    model="EMPTY",
)

GOOD_OIL_CHANGE = MaintenanceEventData(
    id="event-001",
    event_type="oil_change",
    event_date=date(2025, 6, 1),
    mileage=45000,
    cost_cents=129900,
    vendor="Workshop A",
    notes="Full synthetic oil changed on schedule",
    receipt_image_url="https://example.com/receipt.jpg",
)

SEVERE_INCIDENT = IncidentData(
    id="incident-001",
    severity="severe",
    repair_status="not_repaired",
    incident_date=date(2025, 1, 1),
    mileage=40000,
    damage_description="Front collision damage",
    repair_cost_cents=None,
    repair_vendor=None,
    insurance_claim=False,
)

MINOR_REPAIRED_INCIDENT = IncidentData(
    id="incident-002",
    severity="minor",
    repair_status="fully_repaired",
    incident_date=date(2025, 3, 1),
    mileage=42000,
    damage_description="Minor scratch on door",
    repair_cost_cents=50000,
    repair_vendor="Body Shop B",
    insurance_claim=False,
)


# ---------------------------------------------------------------------------
# Test 1 — Pure determinism
# ---------------------------------------------------------------------------

def test_scoring_is_deterministic():
    """
    Given identical inputs and identical as_of date, compute_score must
    always return identical output. Calls the engine three times and
    asserts all results are equal.

    Validates the engine's core design contract: no hidden state, no
    calls to date.today(), no randomness.
    """
    result_1 = compute_score(BASE_CAR, [GOOD_OIL_CHANGE], [], REFERENCE_DATE, DEFAULT_INTERVALS)
    result_2 = compute_score(BASE_CAR, [GOOD_OIL_CHANGE], [], REFERENCE_DATE, DEFAULT_INTERVALS)
    result_3 = compute_score(BASE_CAR, [GOOD_OIL_CHANGE], [], REFERENCE_DATE, DEFAULT_INTERVALS)

    assert result_1.overall_score == result_2.overall_score == result_3.overall_score
    assert result_1.grade == result_2.grade == result_3.grade
    assert result_1.confidence == result_2.confidence == result_3.confidence
    assert result_1.confidence_label == result_2.confidence_label == result_3.confidence_label


# ---------------------------------------------------------------------------
# Test 2 — Domain isolation at runtime
# ---------------------------------------------------------------------------

def test_engine_has_no_infrastructure_imports():
    """
    Verifies at runtime that the engine module imports no infrastructure
    packages. Complements the static import-linter check with a runtime
    assertion.
    """
    import domain.scoring.engine as engine_module

    # Check only the actual import statements, not comments or docstrings
    import ast
    source = inspect.getsource(engine_module)
    tree = ast.parse(source)

    imported_modules = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imported_modules.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imported_modules.add(node.module.split(".")[0])

    forbidden = {"fastapi", "repositories", "config", "schemas"}
    violations = forbidden & imported_modules

    assert not violations, (
        f"Engine imports forbidden infrastructure modules: {violations}"
    )

# ---------------------------------------------------------------------------
# Test 3 — Metamorphic relation: adding a good event cannot lower the score
# ---------------------------------------------------------------------------

def test_adding_good_maintenance_event_does_not_lower_score():
    """
    Metamorphic relation (Chen et al., 1998):
      score(car, events + [good_oil_change]) >= score(car, events)

    Adding a well-documented oil change within the expected service
    interval must not decrease the overall score. The maintenance
    regularity category can only improve when a timely, documented
    event is added, and no other category is negatively affected.
    """
    score_without = compute_score(
        BASE_CAR, [], [], REFERENCE_DATE, DEFAULT_INTERVALS
    ).overall_score

    score_with = compute_score(
        BASE_CAR, [GOOD_OIL_CHANGE], [], REFERENCE_DATE, DEFAULT_INTERVALS
    ).overall_score

    assert score_with >= score_without, (
        f"Score decreased after adding a good maintenance event: "
        f"{score_without} -> {score_with}"
    )


# ---------------------------------------------------------------------------
# Test 4 — Metamorphic relation: severe unrepaired incident lowers the score
# ---------------------------------------------------------------------------

def test_severe_unrepaired_incident_lowers_score():
    """
    Metamorphic relation:
      score(car, events, [severe_unrepaired]) < score(car, events, [])

    A severe incident with repair_status=not_repaired applies a penalty
    of 25 points with zero repair credit. Since incident history carries
    20% weight, the overall score must decrease relative to having no
    incidents.
    """
    score_no_incident = compute_score(
        BASE_CAR, [GOOD_OIL_CHANGE], [], REFERENCE_DATE, DEFAULT_INTERVALS
    ).overall_score

    score_with_incident = compute_score(
        BASE_CAR, [GOOD_OIL_CHANGE], [SEVERE_INCIDENT], REFERENCE_DATE, DEFAULT_INTERVALS
    ).overall_score

    assert score_with_incident < score_no_incident, (
        f"Score did not decrease after adding a severe unrepaired incident: "
        f"{score_no_incident} -> {score_with_incident}"
    )


# ---------------------------------------------------------------------------
# Test 5 — Confidence dampening on empty car
# ---------------------------------------------------------------------------

def test_empty_car_produces_dampened_score():
    """
    A car with no events, no incidents, no mileage, and no EU deadline
    must receive a score dampened toward 50 and a low or very_low
    confidence label.

    Validates the confidence dampening mechanism: sparse data must not
    produce misleadingly high or low scores.
    """
    result = compute_score(
        EMPTY_CAR, [], [], REFERENCE_DATE, DEFAULT_INTERVALS
    )

    assert 35 <= result.overall_score <= 65, (
        f"Empty car score {result.overall_score} is outside expected "
        f"dampened range [35, 65]"
    )
    assert result.confidence_label in ("very_low", "low"), (
        f"Empty car confidence label should be very_low or low, "
        f"got {result.confidence_label}"
    )


# ---------------------------------------------------------------------------
# Test 6 — Grade boundaries
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("score,expected_grade", [
    (90, "A"),
    (75, "B"),
    (60, "C"),
    (40, "D"),
    (39, "F"),
])
def test_grade_boundaries(score, expected_grade):
    """
    Verifies that grade assignment thresholds match the specification:
      A >= 90, B >= 75, C >= 60, D >= 40, F < 40.

    Uses the internal _score_to_grade function directly to test boundary
    values without requiring full engine input construction.
    """
    from domain.scoring.engine import _score_to_grade
    assert _score_to_grade(score) == expected_grade, (
        f"Score {score} should produce grade {expected_grade}, "
        f"got {_score_to_grade(score)}"
    )


# ---------------------------------------------------------------------------
# Test 7 — Fully repaired incident penalises less than unrepaired
# ---------------------------------------------------------------------------

def test_repaired_incident_penalises_less_than_unrepaired():
    """
    Metamorphic relation:
      score(car, events, [minor_fully_repaired]) >
      score(car, events, [severe_not_repaired])

    A minor incident that is fully repaired must produce a higher score
    than a severe incident left unrepaired. Repair diligence must be
    rewarded by the scoring algorithm.
    """
    score_repaired = compute_score(
        BASE_CAR, [GOOD_OIL_CHANGE], [MINOR_REPAIRED_INCIDENT],
        REFERENCE_DATE, DEFAULT_INTERVALS
    ).overall_score

    score_unrepaired = compute_score(
        BASE_CAR, [GOOD_OIL_CHANGE], [SEVERE_INCIDENT],
        REFERENCE_DATE, DEFAULT_INTERVALS
    ).overall_score

    assert score_repaired > score_unrepaired, (
        f"Fully repaired minor incident should score higher than "
        f"unrepaired severe incident: {score_repaired} vs {score_unrepaired}"
    )