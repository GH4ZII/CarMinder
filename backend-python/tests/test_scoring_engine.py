"""
Unit tests for the pure scoring engine.

Every test uses a fixed ``as_of`` date so results are deterministic
and independent of the system clock.
"""
from datetime import date, timedelta

import pytest

from services.scoring_engine import (
    ScoringResult,
    _compute_confidence,
    _event_sort_key,
    _parse_date,
    _score_to_grade,
    compute_score,
)
from services.scoring_normalize import (
    CarData,
    IncidentData,
    MaintenanceEventData,
    ServiceInterval,
)

# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

AS_OF = date(2025, 6, 15)

DEFAULT_INTERVALS: dict[str, ServiceInterval] = {
    "oil_change": ServiceInterval(months=12, km=15000),
    "brake_service": ServiceInterval(months=24, km=30000),
    "tire_change": ServiceInterval(months=48, km=40000),
    "inspection": ServiceInterval(months=12, km=None),
    "repair": ServiceInterval(months=None, km=None),
    "other": ServiceInterval(months=None, km=None),
}


def _car(
    *,
    first_reg: date | None = None,
    km: int = 50000,
    eu_deadline: str | None = "2026-01-01",
) -> CarData:
    return CarData(
        first_registration_date=first_reg or date(2020, 1, 1),
        current_km=km,
        eu_deadline=eu_deadline,
        brand="Toyota",
        model="Corolla",
    )


def _event(
    *,
    id: str = "e1",
    event_type: str = "oil_change",
    event_date: date = date(2025, 1, 15),
    mileage: int | None = 45000,
    cost_cents: int | None = 50000,
    vendor: str | None = "AutoShop",
    notes: str | None = "Regular oil change service",
    receipt_image_url: str | None = None,
) -> MaintenanceEventData:
    return MaintenanceEventData(
        id=id,
        event_type=event_type,
        event_date=event_date,
        mileage=mileage,
        cost_cents=cost_cents,
        vendor=vendor,
        notes=notes,
        receipt_image_url=receipt_image_url,
    )


def _incident(
    *,
    id: str = "i1",
    severity: str = "minor",
    repair_status: str = "fully_repaired",
    incident_date: date = date(2024, 6, 1),
    mileage: int | None = 40000,
    damage_description: str | None = "Small scratch",
    repair_cost_cents: int | None = 10000,
    repair_vendor: str | None = "BodyShop",
    insurance_claim: bool = False,
) -> IncidentData:
    return IncidentData(
        id=id,
        severity=severity,
        repair_status=repair_status,
        incident_date=incident_date,
        mileage=mileage,
        damage_description=damage_description,
        repair_cost_cents=repair_cost_cents,
        repair_vendor=repair_vendor,
        insurance_claim=insurance_claim,
    )


# ---------------------------------------------------------------------------
# 1. Deterministic output test
# ---------------------------------------------------------------------------

class TestDeterministicOutput:
    """Given the same inputs and same as_of, outputs must be identical."""

    def test_same_inputs_produce_same_result(self) -> None:
        car = _car()
        events = [
            _event(id="e1", event_type="oil_change", event_date=date(2024, 6, 1), mileage=30000),
            _event(id="e2", event_type="oil_change", event_date=date(2025, 1, 15), mileage=45000),
            _event(id="e3", event_type="brake_service", event_date=date(2024, 3, 1), mileage=25000),
            _event(id="e4", event_type="inspection", event_date=date(2024, 12, 1), mileage=44000),
        ]
        incidents = [_incident()]

        r1 = compute_score(car, events, incidents, AS_OF, DEFAULT_INTERVALS)
        r2 = compute_score(car, events, incidents, AS_OF, DEFAULT_INTERVALS)

        assert r1.overall_score == r2.overall_score
        assert r1.grade == r2.grade
        assert r1.confidence == r2.confidence
        assert r1.confidence_label == r2.confidence_label
        for key in r1.categories:
            assert r1.categories[key].score == r2.categories[key].score

    def test_different_as_of_can_change_score(self) -> None:
        car = _car(eu_deadline="2025-07-01")
        events = [_event(event_date=date(2025, 5, 1))]
        incidents: list[IncidentData] = []

        r_before = compute_score(car, events, incidents, date(2025, 6, 1), DEFAULT_INTERVALS)
        r_after = compute_score(car, events, incidents, date(2025, 12, 1), DEFAULT_INTERVALS)

        # After 6 more months, score must differ (services become more overdue)
        assert r_before.overall_score != r_after.overall_score


# ---------------------------------------------------------------------------
# 2. Sorting tie-breaker test
# ---------------------------------------------------------------------------

class TestSortingTieBreaker:
    """Two events on the same date must sort deterministically."""

    def test_same_date_different_mileage(self) -> None:
        e1 = _event(id="e1", event_date=date(2025, 1, 15), mileage=40000)
        e2 = _event(id="e2", event_date=date(2025, 1, 15), mileage=41000)

        key1 = _event_sort_key(e1)
        key2 = _event_sort_key(e2)

        # e1 comes before e2 (lower mileage)
        assert key1 < key2

    def test_same_date_same_mileage_different_type(self) -> None:
        e1 = _event(id="e1", event_type="brake_service", event_date=date(2025, 1, 15), mileage=40000)
        e2 = _event(id="e2", event_type="oil_change", event_date=date(2025, 1, 15), mileage=40000)

        key1 = _event_sort_key(e1)
        key2 = _event_sort_key(e2)

        # brake_service < oil_change alphabetically
        assert key1 < key2

    def test_same_date_same_mileage_same_type_different_id(self) -> None:
        e1 = _event(id="aaa", event_date=date(2025, 1, 15), mileage=40000)
        e2 = _event(id="bbb", event_date=date(2025, 1, 15), mileage=40000)

        key1 = _event_sort_key(e1)
        key2 = _event_sort_key(e2)

        assert key1 < key2

    def test_scoring_stable_with_same_date_events(self) -> None:
        """Compute score twice with same-date events; results must match."""
        car = _car()
        events = [
            _event(id="e1", event_type="oil_change", event_date=date(2025, 1, 15), mileage=40000),
            _event(id="e2", event_type="oil_change", event_date=date(2025, 1, 15), mileage=41000),
        ]

        r1 = compute_score(car, events, [], AS_OF, DEFAULT_INTERVALS)
        r2 = compute_score(car, events, [], AS_OF, DEFAULT_INTERVALS)

        assert r1.overall_score == r2.overall_score


# ---------------------------------------------------------------------------
# 3. Missing / invalid date parsing stability
# ---------------------------------------------------------------------------

class TestDateParsing:
    """_parse_date must never raise; always return a valid date."""

    @pytest.mark.parametrize(
        "value",
        [None, "", "Unknown", "garbage", "2025-13-99", 12345, True, [], {}],
    )
    def test_invalid_values_return_fallback(self, value) -> None:  # type: ignore[no-untyped-def]
        fallback = date(2000, 1, 1)
        assert _parse_date(value, fallback) == fallback

    def test_valid_iso_date_parsed(self) -> None:
        assert _parse_date("2025-06-15", date(2000, 1, 1)) == date(2025, 6, 15)

    def test_score_with_no_dates_does_not_crash(self) -> None:
        """Car with no events, no EU deadline, no first-reg."""
        car = CarData(
            first_registration_date=None,
            current_km=0,
            eu_deadline=None,
            brand="",
            model="",
        )
        result = compute_score(car, [], [], AS_OF, DEFAULT_INTERVALS)
        assert 0 <= result.overall_score <= 100
        assert result.grade in ("A", "B", "C", "D", "F")


# ---------------------------------------------------------------------------
# 4. Confidence dampening boundary tests
# ---------------------------------------------------------------------------

class TestConfidenceDampening:
    """Verify the dampening formula at the 0.5 boundary."""

    def test_very_low_confidence_pulls_toward_50(self) -> None:
        """With near-zero confidence, score should gravitate toward 50."""
        # New car, no events, no km, no EU → very low confidence
        car = CarData(
            first_registration_date=AS_OF - timedelta(days=30),
            current_km=0,
            eu_deadline=None,
            brand="",
            model="",
        )
        result = compute_score(car, [], [], AS_OF, DEFAULT_INTERVALS)

        # Confidence should be low
        assert result.confidence < 0.5
        # Score should be dampened toward 50
        assert 40 <= result.overall_score <= 65

    def test_high_confidence_no_dampening(self) -> None:
        """With enough data, score reflects actual category values."""
        car = _car(first_reg=date(2020, 1, 1), km=80000, eu_deadline="2026-06-01")
        # Generous set of events across types
        events = [
            _event(id="e1", event_type="oil_change", event_date=date(2024, 1, 15), mileage=60000),
            _event(id="e2", event_type="oil_change", event_date=date(2025, 1, 15), mileage=75000),
            _event(id="e3", event_type="brake_service", event_date=date(2024, 6, 1), mileage=65000),
            _event(id="e4", event_type="tire_change", event_date=date(2023, 1, 1), mileage=50000),
            _event(id="e5", event_type="inspection", event_date=date(2024, 12, 1), mileage=74000),
            _event(id="e6", event_type="inspection", event_date=date(2023, 12, 1), mileage=55000),
        ]

        result = compute_score(car, events, [], AS_OF, DEFAULT_INTERVALS)
        assert result.confidence >= 0.5

    def test_confidence_function_boundaries(self) -> None:
        # Zero events, new car
        c = _compute_confidence(1, 0, False, False)
        assert 0.0 <= c <= 1.0

        # Plenty of events, old car
        c = _compute_confidence(120, 50, True, True)
        assert c == 1.0


# ---------------------------------------------------------------------------
# 5. Grade boundaries
# ---------------------------------------------------------------------------

class TestGradeBoundaries:
    def test_grade_thresholds(self) -> None:
        assert _score_to_grade(100) == "A"
        assert _score_to_grade(90) == "A"
        assert _score_to_grade(89) == "B"
        assert _score_to_grade(75) == "B"
        assert _score_to_grade(74) == "C"
        assert _score_to_grade(60) == "C"
        assert _score_to_grade(59) == "D"
        assert _score_to_grade(40) == "D"
        assert _score_to_grade(39) == "F"
        assert _score_to_grade(0) == "F"


# ---------------------------------------------------------------------------
# 6. Result structure integrity
# ---------------------------------------------------------------------------

class TestResultStructure:
    def test_all_category_keys_present(self) -> None:
        result = compute_score(_car(), [], [], AS_OF, DEFAULT_INTERVALS)
        expected_keys = {
            "maintenance_regularity",
            "eu_inspection",
            "incident_history",
            "mileage_tracking",
            "documentation_quality",
        }
        assert set(result.categories.keys()) == expected_keys

    def test_weights_sum_to_100(self) -> None:
        result = compute_score(_car(), [], [], AS_OF, DEFAULT_INTERVALS)
        total_weight = sum(c.weight for c in result.categories.values())
        assert total_weight == 100

    def test_result_is_frozen(self) -> None:
        result = compute_score(_car(), [], [], AS_OF, DEFAULT_INTERVALS)
        with pytest.raises(AttributeError):
            result.overall_score = 999  # type: ignore[misc]


# ---------------------------------------------------------------------------
# 7. Engine purity test — no date.today() calls
# ---------------------------------------------------------------------------

class TestEnginePurity:
    """The engine module must not reference date.today()."""

    def test_no_today_in_engine_source(self) -> None:
        import inspect
        from services import scoring_engine as engine

        source = inspect.getsource(engine)
        # The only allowed occurrence is in the docstring
        # Filter out comments and docstrings
        lines = source.split("\n")
        code_lines = []
        in_docstring = False
        for line in lines:
            stripped = line.strip()
            if stripped.startswith('"""') or stripped.startswith("'''"):
                if in_docstring:
                    in_docstring = False
                    continue
                # Check if single-line docstring
                if stripped.count('"""') >= 2 or stripped.count("'''") >= 2:
                    continue
                in_docstring = True
                continue
            if in_docstring:
                continue
            if stripped.startswith("#"):
                continue
            code_lines.append(line)

        code_text = "\n".join(code_lines)
        assert "date.today()" not in code_text, "engine.py must not call date.today()"
        assert "datetime.utcnow()" not in code_text, "engine.py must not call datetime.utcnow()"
