from typing import List

from fastapi import APIRouter, Depends, HTTPException

from config.auth import get_current_user_uid
from exceptions import AlreadyExistsError, NotFoundError, ValidationError
from schemas.car import (
    CarCreate,
    CarResponse,
    CarUpdate,
    KilometerUpdate,
    VehicleLookupRequest,
    VehicleLookupResponse,
)
from services import car_service

router = APIRouter(prefix="/cars", tags=["cars"])


@router.post("/lookup", response_model=VehicleLookupResponse)
async def lookup_vehicle_info(request: VehicleLookupRequest):
    try:
        car = await car_service.lookup(request.registration_number)
        if car:
            return VehicleLookupResponse(success=True, car=car)
        return VehicleLookupResponse(success=False, error="Vehicle not found")
    except Exception as e:
        return VehicleLookupResponse(success=False, error=str(e))


@router.post("/", response_model=CarResponse)
def create_car(car: CarCreate, uid: str = Depends(get_current_user_uid)):
    try:
        return car_service.create_car(uid, car)
    except AlreadyExistsError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/", response_model=List[CarResponse])
def get_user_cars(uid: str = Depends(get_current_user_uid)):
    return car_service.get_user_cars(uid)


@router.get("/{car_id}", response_model=CarResponse)
def get_car_by_id(car_id: str, uid: str = Depends(get_current_user_uid)):
    try:
        return car_service.get_car(uid, car_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.patch("/{car_id}", response_model=CarResponse)
def update_car(car_id: str, updates: CarUpdate, uid: str = Depends(get_current_user_uid)):
    try:
        return car_service.update_car(uid, car_id, updates)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.patch("/{car_id}/kilometer", response_model=CarResponse)
def update_kilometer(car_id: str, data: KilometerUpdate, uid: str = Depends(get_current_user_uid)):
    try:
        return car_service.update_kilometer(uid, car_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.delete("/{car_id}")
def delete_car(car_id: str, uid: str = Depends(get_current_user_uid)):
    try:
        car_service.delete_car(uid, car_id)
        return {"message": "Car deleted successfully", "id": car_id}
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
