from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi.testclient import TestClient

from exceptions import NotFoundError, ValidationError
from schemas.car import CarBase
from schemas.car_score import CarCareScoreResponse, CategoryBreakdown, CategoryScore
from schemas.service_interval import CarServiceStatus, ServiceDueStatus


def build_score_response(car_id: str = "car-123") -> CarCareScoreResponse:
    return CarCareScoreResponse(
        car_id=car_id,
        overall_score=82,
        grade="B",
        confidence=0.73,
        confidence_label="moderate",
        summary="Test Car receives a care grade of B (Good care). Overall score: 82/100.",
        categories=CategoryBreakdown(
            maintenance_regularity=CategoryScore(
                score=88,
                weight=40,
                label="Maintenance Regularity",
            ),
            eu_inspection=CategoryScore(
                score=91,
                weight=15,
                label="EU Inspection Compliance",
            ),
            incident_history=CategoryScore(
                score=79,
                weight=20,
                label="Incident History & Repairs",
            ),
            mileage_tracking=CategoryScore(
                score=70,
                weight=10,
                label="Mileage Tracking",
            ),
            documentation_quality=CategoryScore(
                score=76,
                weight=15,
                label="Documentation Quality",
            ),
        ),
        recommendations=[
            "Some maintenance services are overdue. Check your service intervals dashboard for upcoming due dates.",
        ],
        computed_at=datetime(2026, 4, 16, 12, 0, tzinfo=timezone.utc),
        scoring_version="1.0.0",
        scored_as_of=date(2026, 4, 16),
    )


def build_service_status(car_id: str = "car-123") -> CarServiceStatus:
    next_service = ServiceDueStatus(
        event_type="oil_change",
        last_date=date(2025, 6, 1),
        last_mileage=45000,
        due_date=date(2026, 5, 1),
        due_mileage=60000,
        is_overdue=False,
        days_until_due=15,
        km_until_due=900,
        urgency="soon",
    )
    return CarServiceStatus(
        car_id=car_id,
        car_name="Test Car",
        registration="AB12345",
        current_mileage=59100,
        services=[next_service],
        next_service=next_service,
    )


def test_get_car_score_success(authenticated_client: TestClient, monkeypatch) -> None:
    expected = build_score_response()

    def fake_compute_car_care_score(uid: str, car_id: str) -> CarCareScoreResponse:
        assert uid == "test-user-123"
        assert car_id == "car-123"
        return expected

    monkeypatch.setattr(
        "routers.car_score.scoring_service.compute_car_care_score",
        fake_compute_car_care_score,
    )

    response = authenticated_client.get("/cars/car-123/score")

    assert response.status_code == 200
    body = response.json()
    assert body["car_id"] == "car-123"
    assert body["overall_score"] == 82
    assert body["grade"] == "B"
    assert body["confidence_label"] == "moderate"
    assert body["categories"]["maintenance_regularity"]["score"] == 88
    assert body["recommendations"] == expected.recommendations


def test_get_car_score_requires_authentication(client: TestClient) -> None:
    response = client.get("/cars/car-123/score")

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing Authorization header"


def test_get_car_score_returns_404_when_car_missing(
    authenticated_client: TestClient, monkeypatch
) -> None:
    def fake_compute_car_care_score(uid: str, car_id: str) -> CarCareScoreResponse:
        raise NotFoundError("Car not found")

    monkeypatch.setattr(
        "routers.car_score.scoring_service.compute_car_care_score",
        fake_compute_car_care_score,
    )

    response = authenticated_client.get("/cars/car-123/score")

    assert response.status_code == 404
    assert response.json()["detail"] == "Car not found"


def test_create_maintenance_event_success(authenticated_client: TestClient, monkeypatch) -> None:
    def fake_create_event(uid: str, car_id: str, payload) -> dict:
        assert uid == "test-user-123"
        assert car_id == "car-123"
        assert payload.event_type == "oil_change"
        assert payload.mileage == 55000
        return {
            "id": "event-123",
            "car_id": car_id,
            "event_type": payload.event_type,
            "event_date": payload.event_date,
            "mileage": payload.mileage,
            "cost_cents": 129900,
            "vendor": payload.vendor,
            "notes": payload.notes,
            "receipt_image_url": None,
            "created_at": datetime(2026, 4, 16, 12, 0, tzinfo=timezone.utc),
        }

    monkeypatch.setattr(
        "routers.maintenance_event.maintenance_service.create_event",
        fake_create_event,
    )

    response = authenticated_client.post(
        "/cars/car-123/events",
        json={
            "event_type": "oil_change",
            "event_date": "2026-04-10",
            "mileage": 55000,
            "cost": 1299.0,
            "vendor": "Workshop A",
            "notes": "Changed on time",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "event-123"
    assert body["event_type"] == "oil_change"
    assert body["cost_cents"] == 129900
    assert body["vendor"] == "Workshop A"


def test_create_maintenance_event_rejects_invalid_payload(
    authenticated_client: TestClient,
) -> None:
    response = authenticated_client.post(
        "/cars/car-123/events",
        json={
            "event_type": "made_up_type",
            "event_date": "2099-01-01",
        },
    )

    assert response.status_code == 422
    errors = response.json()["detail"]
    messages = [error["msg"] for error in errors]
    assert any("event_type must be one of" in message for message in messages)
    assert any("event_date cannot be in the future" in message for message in messages)


def test_create_incident_success(authenticated_client: TestClient, monkeypatch) -> None:
    def fake_create_incident(uid: str, car_id: str, payload) -> dict:
        assert uid == "test-user-123"
        assert car_id == "car-123"
        assert payload.description == "Rear bumper damage"
        return {
            "id": "incident-123",
            "car_id": car_id,
            "incident_date": payload.incident_date,
            "severity": payload.severity,
            "description": payload.description,
            "damage_description": payload.damage_description,
            "repair_status": payload.repair_status,
            "repair_cost_cents": 349900,
            "repair_vendor": payload.repair_vendor,
            "insurance_claim": payload.insurance_claim,
            "mileage": payload.mileage,
            "created_at": datetime(2026, 4, 16, 12, 0, tzinfo=timezone.utc),
        }

    monkeypatch.setattr(
        "routers.incident_report.incident_service.create_incident",
        fake_create_incident,
    )

    response = authenticated_client.post(
        "/cars/car-123/incidents",
        json={
            "incident_date": "2026-04-10",
            "severity": "moderate",
            "description": "Rear bumper damage",
            "damage_description": "Rear bumper dent and paint damage",
            "repair_status": "fully_repaired",
            "repair_cost": 3499.0,
            "repair_vendor": "Workshop A",
            "insurance_claim": True,
            "mileage": 55000,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "incident-123"
    assert body["description"] == "Rear bumper damage"
    assert body["repair_cost_cents"] == 349900


def test_create_maintenance_event_returns_404(
    authenticated_client: TestClient, monkeypatch
) -> None:
    def fake_create_event(uid: str, car_id: str, payload) -> dict:
        raise NotFoundError("Car not found")

    monkeypatch.setattr(
        "routers.maintenance_event.maintenance_service.create_event",
        fake_create_event,
    )

    response = authenticated_client.post(
        "/cars/car-123/events",
        json={
            "event_type": "oil_change",
            "event_date": "2026-04-10",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Car not found"


def test_create_maintenance_event_returns_400(
    authenticated_client: TestClient, monkeypatch
) -> None:
    def fake_create_event(uid: str, car_id: str, payload) -> dict:
        raise ValidationError("Failed to create event")

    monkeypatch.setattr(
        "routers.maintenance_event.maintenance_service.create_event",
        fake_create_event,
    )

    response = authenticated_client.post(
        "/cars/car-123/events",
        json={
            "event_type": "oil_change",
            "event_date": "2026-04-10",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Failed to create event"


def test_get_service_status_success(authenticated_client: TestClient, monkeypatch) -> None:
    expected = build_service_status()

    def fake_get_car_service_status(uid: str, car_id: str) -> CarServiceStatus:
        assert uid == "test-user-123"
        assert car_id == "car-123"
        return expected

    monkeypatch.setattr(
        "routers.service_interval.service_interval_service.get_car_service_status",
        fake_get_car_service_status,
    )

    response = authenticated_client.get("/cars/car-123/service-status")

    assert response.status_code == 200
    body = response.json()
    assert body["car_id"] == "car-123"
    assert body["next_service"]["event_type"] == "oil_change"
    assert body["next_service"]["urgency"] == "soon"
    assert body["services"][0]["km_until_due"] == 900


def test_get_service_status_requires_authentication(client: TestClient) -> None:
    response = client.get("/cars/car-123/service-status")

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing Authorization header"


def test_get_service_status_returns_404(
    authenticated_client: TestClient, monkeypatch
) -> None:
    def fake_get_car_service_status(uid: str, car_id: str) -> CarServiceStatus:
        raise NotFoundError("Car not found")

    monkeypatch.setattr(
        "routers.service_interval.service_interval_service.get_car_service_status",
        fake_get_car_service_status,
    )

    response = authenticated_client.get("/cars/car-123/service-status")

    assert response.status_code == 404
    assert response.json()["detail"] == "Car not found"


def test_lookup_vehicle_success(client: TestClient, monkeypatch) -> None:
    async def fake_lookup(registration_number: str) -> CarBase | None:
        assert registration_number == "AB12345"
        return CarBase(
            registreringsnummer="AB12345",
            merke="Toyota",
            modell="Corolla",
            arsmodell="2020",
            farge="Blue",
            kilometer=0,
            forstegangregistrert="2020-01-15",
            chassisnummer="VIN123456789",
            drivstoff="Petrol",
            girkasse="Automatic",
            motoreffekt=132,
            slagvolum=1798,
            co2utslipp=110,
            forbruk=5.0,
            egenvekt=1300,
            totalvekt=1800,
            antallseter=5,
            antalldorer=4,
            karosseri="Sedan",
            eukontrollfrist="2026-12-01",
            makshastighet=180,
            public_history=False,
        )

    monkeypatch.setattr("routers.car.car_service.lookup", fake_lookup)

    response = client.post(
        "/cars/lookup",
        json={"registration_number": "AB12345"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["car"]["registreringsnummer"] == "AB12345"
    assert body["car"]["merke"] == "Toyota"
    assert body["car"]["eukontrollfrist"] == "2026-12-01"


def test_lookup_vehicle_not_found(client: TestClient, monkeypatch) -> None:
    async def fake_lookup(registration_number: str) -> CarBase | None:
        return None

    monkeypatch.setattr("routers.car.car_service.lookup", fake_lookup)

    response = client.post(
        "/cars/lookup",
        json={"registration_number": "ZZ99999"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "success": False,
        "car": None,
        "error": "Vehicle not found",
    }
