from datetime import date, datetime, timezone

from fastapi.testclient import TestClient

from main import app
from schemas.car_score import (
    CarCareScoreResponse,
    CategoryBreakdown,
    CategoryScore,
)
from schemas.car_twin import OwnershipTwinRequest
from services import car_twin_service


def _score_response(car_id: str, score: int, grade: str) -> CarCareScoreResponse:
    cats = CategoryBreakdown(
        maintenance_regularity=CategoryScore(score=score, weight=40, label="Maintenance"),
        eu_inspection=CategoryScore(score=score, weight=15, label="EU"),
        incident_history=CategoryScore(score=score, weight=20, label="Incidents"),
        mileage_tracking=CategoryScore(score=score, weight=10, label="Mileage"),
        documentation_quality=CategoryScore(score=score, weight=15, label="Docs"),
    )
    return CarCareScoreResponse(
        car_id=car_id,
        overall_score=score,
        grade=grade,
        confidence=0.8,
        confidence_label="high",
        summary="summary",
        categories=cats,
        recommendations=["Keep up maintenance"],
        computed_at=datetime.now(timezone.utc),
        scoring_version="1.0.0",
        scored_as_of=date.today(),
    )


def test_simulate_ownership_twin_delay(monkeypatch):
    raw_car = {
        "id": "car-1",
        "merke": "Toyota",
        "modell": "Corolla",
        "kilometer": 50000,
        "eukontrollfrist": "2026-12-01",
    }
    raw_events = [
        {
            "id": "e1",
            "car_id": "car-1",
            "event_type": "oil_change",
            "event_date": "2025-01-10",
            "mileage": 42000,
            "cost_cents": 12000,
            "vendor": "Shop",
            "notes": "Oil",
            "receipt_image_url": None,
            "created_at": "2025-01-10T09:00:00",
        }
    ]

    monkeypatch.setattr(
        "services.car_twin_service.car_repository.get_car_by_id_and_user",
        lambda car_id, uid: raw_car,
    )
    monkeypatch.setattr(
        "services.car_twin_service.maintenance_repository.list_events_for_car",
        lambda car_id: raw_events,
    )
    monkeypatch.setattr(
        "services.car_twin_service.incident_repository.list_incidents_for_car",
        lambda car_id: [],
    )

    calls = {"count": 0}

    def fake_compute(*, raw_car, raw_events, raw_incidents, as_of):
        calls["count"] += 1
        if calls["count"] == 1:
            return _score_response("car-1", 78, "B")
        return _score_response("car-1", 70, "C")

    monkeypatch.setattr(
        "services.car_twin_service.scoring_service.compute_car_care_score_from_snapshot",
        fake_compute,
    )
    monkeypatch.setattr(
        "services.car_twin_service.generate_twin_explanation",
        lambda **kwargs: ("LLM narrative", ["Action 1"], "rule_based"),
    )

    payload = OwnershipTwinRequest(
        action="delay", event_type="oil_change", delay_days=60, monthly_km=1200
    )
    out = car_twin_service.simulate_ownership_twin("uid-1", "car-1", payload)

    assert out.car_id == "car-1"
    assert out.action == "delay"
    assert out.score_delta == -8
    assert out.risk_change == "worsened"
    assert out.narrative == "LLM narrative"
    assert out.projected_recommendations == ["Action 1"]
    assert out.explanation_source == "rule_based"


def test_car_twin_route(monkeypatch):
    from config.auth import get_current_user_uid

    app.dependency_overrides[get_current_user_uid] = lambda: "uid-1"

    monkeypatch.setattr(
        "services.car_twin_service.simulate_ownership_twin",
        lambda uid, car_id, payload: {
            "car_id": car_id,
            "action": payload.action,
            "event_type": payload.event_type,
            "assumptions": ["x"],
            "baseline": {
                "overall_score": 70,
                "grade": "C",
                "confidence": 0.8,
                "confidence_label": "high",
            },
            "projected": {
                "overall_score": 75,
                "grade": "B",
                "confidence": 0.8,
                "confidence_label": "high",
            },
            "category_deltas": [],
            "baseline_urgency": "soon",
            "projected_urgency": "ok",
            "score_delta": 5,
            "risk_change": "improved",
            "explanation_source": "rule_based",
            "narrative": "narrative",
            "projected_recommendations": ["a"],
            "computed_at": datetime.now(timezone.utc).isoformat(),
            "scoring_version": "1.0.0",
            "projected_as_of": date.today().isoformat(),
        },
    )

    client = TestClient(app)
    res = client.post(
        "/cars/car-1/ownership-twin",
        json={
            "action": "do_now",
            "event_type": "oil_change",
            "delay_days": 60,
            "monthly_km": 1200,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["car_id"] == "car-1"
    assert body["risk_change"] == "improved"

    app.dependency_overrides.clear()
