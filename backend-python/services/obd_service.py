import json
from typing import Any

from exceptions import NotFoundError, ValidationError
from repositories import car_repository, obd_repository
from schemas.obd_reading import ObdReadingCreate


def create_reading(uid: str, car_id: str, payload: ObdReadingCreate) -> dict[str, Any]:
    _ensure_car_ownership(uid, car_id)

    dtcs = [d.model_dump() for d in payload.dtcs]
    row = {
        "car_id": car_id,
        "captured_at": payload.captured_at.isoformat(),
        "source": payload.source,
        "rpm": payload.rpm,
        "coolant_temp_c": payload.coolant_temp_c,
        "speed_kph": payload.speed_kph,
        "engine_load_pct": payload.engine_load_pct,
        "battery_voltage": payload.battery_voltage,
        "fuel_rate_lph": payload.fuel_rate_lph,
        "fuel_consumption_l_100km": payload.fuel_consumption_l_100km,
        "mass_air_flow_gps": payload.mass_air_flow_gps,
        "fuel_rate_source": payload.fuel_rate_source,
        "dtcs": dtcs,
    }

    result = obd_repository.insert_reading(row)
    if not result:
        raise ValidationError("Failed to save OBD reading")
    return _normalize_reading(result)


def get_latest(uid: str, car_id: str) -> dict[str, Any] | None:
    _ensure_car_ownership(uid, car_id)
    row = obd_repository.get_latest_reading(car_id)
    return _normalize_reading(row) if row else None


def list_readings(uid: str, car_id: str, limit: int = 50) -> list[dict[str, Any]]:
    _ensure_car_ownership(uid, car_id)
    return [_normalize_reading(row) for row in obd_repository.list_readings_for_car(car_id, limit=limit)]


def _ensure_car_ownership(uid: str, car_id: str) -> None:
    car = car_repository.get_car_by_id_and_user(car_id, uid)
    if not car:
        raise NotFoundError("Car not found")


def _normalize_reading(row: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(row)
    normalized["dtcs"] = _normalize_dtcs(normalized.get("dtcs"))
    return normalized


def _normalize_dtcs(value: Any) -> list[dict[str, Any]]:
    if value is None:
        return []
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return []
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
    return []
