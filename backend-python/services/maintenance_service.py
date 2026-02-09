from typing import Any

from exceptions import NotFoundError, ValidationError
from repositories import car_repository, maintenance_repository
from schemas.maintenance_event import MaintenanceEventCreate


def list_events(uid: str, car_id: str) -> list[dict[str, Any]]:
    _ensure_car_ownership(uid, car_id)
    return maintenance_repository.list_events_for_car(car_id)


def create_event(uid: str, car_id: str, payload: MaintenanceEventCreate) -> dict[str, Any]:
    _ensure_car_ownership(uid, car_id)

    cost_cents = None
    if payload.cost is not None:
        cost_cents = max(0, int(round(payload.cost * 100)))

    row = {
        "car_id": car_id,
        "event_type": payload.event_type,
        "event_date": payload.event_date.isoformat(),
        "mileage": payload.mileage,
        "cost_cents": cost_cents,
        "vendor": payload.vendor,
        "notes": payload.notes,
    }

    result = maintenance_repository.insert_event(row)
    if not result:
        raise ValidationError("Failed to create event")
    return result


def _ensure_car_ownership(uid: str, car_id: str) -> None:
    car = car_repository.get_car_by_id_and_user(car_id, uid)
    if not car:
        raise NotFoundError("Car not found")
