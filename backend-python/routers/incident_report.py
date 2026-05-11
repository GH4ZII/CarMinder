from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from config.auth import get_current_user_uid
from config.responses import AUTH_RESPONSES, PROTECTED_RESPONSES
from exceptions import NotFoundError, ValidationError
from schemas.incident_report import (
    REPAIR_STATUSES,
    SEVERITY_LEVELS,
    IncidentReportCreate,
    IncidentReportResponse,
)
from services import incident_image_service, incident_service

router = APIRouter(prefix="/cars", tags=["incidents"])
router_meta = APIRouter(prefix="/incidents", tags=["incidents"])


@router_meta.get("/types")
def get_incident_types():
    return {"severity_levels": SEVERITY_LEVELS, "repair_statuses": REPAIR_STATUSES}


@router.get(
    "/{car_id}/incidents",
    response_model=List[IncidentReportResponse],
    responses={**AUTH_RESPONSES, 404: {"description": "Car not found"}},
)
def list_incidents(car_id: str, uid: str = Depends(get_current_user_uid)):
    try:
        return incident_service.list_incidents(uid, car_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.post(
    "/{car_id}/incidents",
    response_model=IncidentReportResponse,
    responses=PROTECTED_RESPONSES,
)
def create_incident(
    car_id: str,
    payload: IncidentReportCreate,
    uid: str = Depends(get_current_user_uid),
):
    try:
        return incident_service.create_incident(uid, car_id, payload)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post(
    "/{car_id}/incidents/{incident_id}/images",
    responses=PROTECTED_RESPONSES,
)
async def upload_incident_images(
    car_id: str,
    incident_id: str,
    files: List[UploadFile] = File(...),
    uid: str = Depends(get_current_user_uid),
):
    try:
        return await incident_image_service.upload_images_for_incident(
            uid=uid, car_id=car_id, incident_id=incident_id, files=list(files)
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get(
    "/{car_id}/incidents/{incident_id}/images",
    responses=PROTECTED_RESPONSES,
)
def list_incident_images(
    car_id: str,
    incident_id: str,
    uid: str = Depends(get_current_user_uid),
):
    try:
        return incident_image_service.list_images_for_incident(uid=uid, car_id=car_id, incident_id=incident_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)


@router_meta.get("/public/images/{image_id}")
def get_public_incident_image(image_id: str):
    try:
        raw, content_type = incident_image_service.get_public_image_bytes(image_id)
        return Response(content=raw, media_type=content_type)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
