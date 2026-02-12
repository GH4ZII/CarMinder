from typing import List

from fastapi import APIRouter, Depends, HTTPException

from config.auth import get_current_user_uid
from exceptions import NotFoundError, ValidationError
from schemas.incident_report import (
    REPAIR_STATUSES,
    SEVERITY_LEVELS,
    IncidentReportCreate,
    IncidentReportResponse,
)
from services import incident_service

router = APIRouter(prefix="/cars", tags=["incidents"])
router_meta = APIRouter(prefix="/incidents", tags=["incidents"])


@router_meta.get("/types")
def get_incident_types():
    return {"severity_levels": SEVERITY_LEVELS, "repair_statuses": REPAIR_STATUSES}


@router.get("/{car_id}/incidents", response_model=List[IncidentReportResponse])
def list_incidents(car_id: str, uid: str = Depends(get_current_user_uid)):
    try:
        return incident_service.list_incidents(uid, car_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.post("/{car_id}/incidents", response_model=IncidentReportResponse)
def create_incident(car_id: str, payload: IncidentReportCreate, uid: str = Depends(get_current_user_uid)):
    try:
        return incident_service.create_incident(uid, car_id, payload)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)
