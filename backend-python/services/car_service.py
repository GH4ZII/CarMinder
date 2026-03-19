import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from config.settings import get_settings
from exceptions import AlreadyExistsError, NotFoundError, ValidationError
from repositories import car_repository
from schemas.car import CarCreate, CarUpdate, KilometerUpdate
from services.vehicle_lookup_service import lookup_vehicle

_TRANSFER_CODE_EXPIRY_HOURS = 24


async def lookup(registration_number: str):
    return await lookup_vehicle(registration_number)


def create_car(uid: str, car: CarCreate) -> dict[str, Any]:
    existing = car_repository.get_car_by_vin(car.chassisnummer)
    if existing:
        if existing.get("retired_at"):
            raise ValidationError(
                "This vehicle has been retired (damaged beyond repair) and cannot be registered again"
            )
        raise AlreadyExistsError("A car with this VIN is already registered")

    car_data = car.model_dump()
    car_data["firebase_user_id"] = uid

    result = car_repository.insert_car(car_data)
    if not result:
        raise ValidationError("Failed to create car")
    return result


def get_user_cars(uid: str) -> list[dict[str, Any]]:
    return car_repository.get_cars_by_user(uid)


def get_car(uid: str, car_id: str) -> dict[str, Any]:
    car = car_repository.get_car_by_id_and_user(car_id, uid)
    if not car:
        raise NotFoundError("Car not found")
    return car


def update_car(uid: str, car_id: str, updates: CarUpdate) -> dict[str, Any]:
    _ensure_ownership(uid, car_id)

    update_data = updates.model_dump(exclude_unset=True)
    if not update_data:
        raise ValidationError("No fields to update")

    result = car_repository.update_car(car_id, update_data)
    if not result:
        raise ValidationError("Failed to update car")
    return result


def update_kilometer(uid: str, car_id: str, data: KilometerUpdate) -> dict[str, Any]:
    car = car_repository.get_car_by_id_and_user(car_id, uid)
    if not car:
        raise NotFoundError("Car not found")

    if data.kilometer < car.get("kilometer", 0):
        raise ValidationError("New kilometer must be higher than current")

    result = car_repository.update_car(car_id, {"kilometer": data.kilometer})
    if not result:
        raise ValidationError("Failed to update kilometer")
    return result


def delete_car(uid: str, car_id: str) -> None:
    _ensure_ownership(uid, car_id)
    car_repository.delete_car(car_id)


def retire_car(uid: str, car_id: str) -> dict[str, Any]:
    car = _ensure_ownership_and_return(uid, car_id)
    if car.get("retired_at"):
        raise ValidationError("Car is already retired")

    result = car_repository.update_car(car_id, {
        "retired_at": datetime.now(timezone.utc).isoformat(),
        "transfer_code": None,
        "transfer_code_expires_at": None,
    })
    if not result:
        raise ValidationError("Failed to retire car")
    return result


def initiate_transfer(uid: str, car_id: str) -> dict[str, str]:
    car = _ensure_ownership_and_return(uid, car_id)
    if car.get("retired_at"):
        raise ValidationError("Cannot transfer a retired car")

    raw_token = secrets.token_urlsafe(32)
    code_hash = _hmac_hash(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=_TRANSFER_CODE_EXPIRY_HOURS)

    result = car_repository.update_car(car_id, {
        "transfer_code": code_hash,
        "transfer_code_expires_at": expires_at.isoformat(),
    })
    if not result:
        raise ValidationError("Failed to initiate transfer")

    return {"transfer_code": raw_token, "expires_at": expires_at.isoformat()}


def claim_car(uid: str, raw_token: str) -> dict[str, Any]:
    code_hash = _hmac_hash(raw_token)
    car = car_repository.get_car_by_transfer_code(code_hash)

    if not car:
        raise NotFoundError("Invalid transfer code")

    expires_at = car.get("transfer_code_expires_at")
    if expires_at:
        exp_dt = datetime.fromisoformat(expires_at)
        if exp_dt < datetime.now(timezone.utc):
            raise ValidationError("Transfer code has expired")

    if car.get("retired_at"):
        raise ValidationError("This car has been retired and cannot be claimed")

    if car["firebase_user_id"] == uid:
        raise ValidationError("Cannot transfer car to yourself")

    result = car_repository.update_car(car["id"], {
        "firebase_user_id": uid,
        "transfer_code": None,
        "transfer_code_expires_at": None,
    })
    if not result:
        raise ValidationError("Failed to claim car")
    return result


def cancel_transfer(uid: str, car_id: str) -> dict[str, Any]:
    _ensure_ownership(uid, car_id)

    result = car_repository.update_car(car_id, {
        "transfer_code": None,
        "transfer_code_expires_at": None,
    })
    if not result:
        raise ValidationError("Failed to cancel transfer")
    return result


def _hmac_hash(token: str) -> str:
    secret = get_settings()["JWT_SECRET_KEY"] or ""
    return hmac.new(secret.encode(), token.encode(), hashlib.sha256).hexdigest()


def _ensure_ownership(uid: str, car_id: str) -> None:
    car = car_repository.get_car_by_id_and_user(car_id, uid)
    if not car:
        raise NotFoundError("Car not found")


def _ensure_ownership_and_return(uid: str, car_id: str) -> dict[str, Any]:
    car = car_repository.get_car_by_id_and_user(car_id, uid)
    if not car:
        raise NotFoundError("Car not found")
    return car
