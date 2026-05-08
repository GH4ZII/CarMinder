from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from config.auth import get_current_user_uid
from config.responses import AUTH_RESPONSES, PROTECTED_RESPONSES
from exceptions import NotFoundError, ValidationError
from schemas.obd_reading import ObdReadingCreate, ObdReadingResponse
from services import obd_service

router = APIRouter(prefix="/cars", tags=["obd"])


@router.post(
    "/{car_id}/obd-readings",
    response_model=ObdReadingResponse,
    responses=PROTECTED_RESPONSES,
)
def create_reading(
    car_id: str,
    payload: ObdReadingCreate,
    uid: str = Depends(get_current_user_uid),
):
    try:
        return obd_service.create_reading(uid, car_id, payload)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get(
    "/{car_id}/obd-readings/latest",
    response_model=Optional[ObdReadingResponse],
    responses={**AUTH_RESPONSES, 404: {"description": "Car not found"}},
)
def get_latest_reading(
    car_id: str,
    uid: str = Depends(get_current_user_uid),
):
    try:
        return obd_service.get_latest(uid, car_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.get(
    "/{car_id}/obd-readings",
    response_model=List[ObdReadingResponse],
    responses={**AUTH_RESPONSES, 404: {"description": "Car not found"}},
)
def list_readings(
    car_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    uid: str = Depends(get_current_user_uid),
):
    try:
        return obd_service.list_readings(uid, car_id, limit=limit)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
