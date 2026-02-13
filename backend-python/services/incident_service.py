from typing import Any

from exceptions import NotFoundError, ValidationError
from repositories import car_repository, incident_repository
from schemas.incident_report import IncidentReportCreate


def list_incidents(uid: str, car_id: str) -> list[dict[str, Any]]:
    _ensure_car_ownership(uid, car_id)
    return incident_repository.list_incidents_for_car(car_id)


def create_incident(uid: str, car_id: str, payload: IncidentReportCreate) -> dict[str, Any]:
    _ensure_car_ownership(uid, car_id)

    repair_cost_cents = None
    if payload.repair_cost is not None:
        repair_cost_cents = max(0, int(round(payload.repair_cost * 100)))

    row = {
        "car_id": car_id,
        "incident_date": payload.incident_date.isoformat(),
        "severity": payload.severity,
        "description": payload.description,
        "damage_description": payload.damage_description,
        "repair_status": payload.repair_status,
        "repair_cost_cents": repair_cost_cents,
        "repair_vendor": payload.repair_vendor,
        "insurance_claim": payload.insurance_claim,
        "mileage": payload.mileage,
    }

    result = incident_repository.insert_incident(row)
    if not result:
        raise ValidationError("Failed to create incident report")
    return result


def _ensure_car_ownership(uid: str, car_id: str) -> None:
    car = car_repository.get_car_by_id_and_user(car_id, uid)
    if not car:
        raise NotFoundError("Car not found")
