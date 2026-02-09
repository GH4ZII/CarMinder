from typing import Any

from exceptions import AlreadyExistsError, NotFoundError, ValidationError
from repositories import car_repository
from schemas.car import CarCreate, CarUpdate, KilometerUpdate
from services.vehicle_lookup_service import lookup_vehicle


async def lookup(registration_number: str):
    return await lookup_vehicle(registration_number)


def create_car(uid: str, car: CarCreate) -> dict[str, Any]:
    if car_repository.car_exists_for_user(uid, car.registreringsnummer):
        raise AlreadyExistsError("Car already registered to this user")

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


def _ensure_ownership(uid: str, car_id: str) -> None:
    car = car_repository.get_car_by_id_and_user(car_id, uid)
    if not car:
        raise NotFoundError("Car not found")
