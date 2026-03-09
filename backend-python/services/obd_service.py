import json
from typing import Any

from exceptions import NotFoundError, ValidationError
from repositories import car_repository, obd_repository
from schemas.obd_reading import ObdReadingCreate


def create_reading(uid: str, car_id: str, payload: ObdReadingCreate) -> dict[str, Any]:
    _ensure_car_ownership(uid, car_id)

    row = {
        "car_id": car_id,
        "captured_at": payload.captured_at.isoformat(),
        "source": payload.source,
        "rpm": payload.rpm,
        "coolant_temp_c": payload.coolant_temp_c,
        "speed_kph": payload.speed_kph,
        "engine_load_pct": payload.engine_load_pct,
        "battery_voltage": payload.battery_voltage,
        "dtcs": json.dumps([d.model_dump() for d in payload.dtcs]),
    }

    result = obd_repository.insert_reading(row)
    if not result:
        raise ValidationError("Failed to save OBD reading")
    return result


def get_latest(uid: str, car_id: str) -> dict[str, Any] | None:
    _ensure_car_ownership(uid, car_id)
    return obd_repository.get_latest_reading(car_id)


def list_readings(uid: str, car_id: str, limit: int = 50) -> list[dict[str, Any]]:
    _ensure_car_ownership(uid, car_id)
    return obd_repository.list_readings_for_car(car_id, limit=limit)


def _ensure_car_ownership(uid: str, car_id: str) -> None:
    car = car_repository.get_car_by_id_and_user(car_id, uid)
    if not car:
        raise NotFoundError("Car not found")
