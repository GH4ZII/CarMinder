import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from config.auth import get_current_user_uid
from exceptions import NotFoundError, ValidationError
from schemas.maintenance_event import (
    EVENT_TYPES,
    MaintenanceEventCreate,
    MaintenanceEventResponse,
)
from services import maintenance_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cars", tags=["maintenance"])
router_meta = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router_meta.get("/event-types")
def get_event_types():
    return {"event_types": EVENT_TYPES}


@router.get("/{car_id}/events", response_model=List[MaintenanceEventResponse])
def list_events(car_id: str, uid: str = Depends(get_current_user_uid)):
    try:
        return maintenance_service.list_events(uid, car_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except Exception as e:
        logger.exception("Unexpected error listing events for car %s", car_id)
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


@router.post("/{car_id}/events", response_model=MaintenanceEventResponse)
def create_event(car_id: str, payload: MaintenanceEventCreate, uid: str = Depends(get_current_user_uid)):
    try:
        return maintenance_service.create_event(uid, car_id, payload)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        logger.exception("Unexpected error creating event for car %s", car_id)
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")
