from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from config.auth import get_current_user_uid
from exceptions import NotFoundError, ValidationError
from schemas.maintenance_event import (
    EVENT_TYPES,
    MaintenanceEventCreate,
    MaintenanceEventResponse,
)
from schemas.receipt import ScanReceiptResponse
from services import maintenance_service, receipt_service

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


@router.post("/{car_id}/events", response_model=MaintenanceEventResponse)
def create_event(car_id: str, payload: MaintenanceEventCreate, uid: str = Depends(get_current_user_uid)):
    try:
        return maintenance_service.create_event(
            uid, car_id, payload, receipt_image_url=payload.receipt_image_url
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/{car_id}/events/scan-receipt", response_model=ScanReceiptResponse)
async def scan_receipt(
    car_id: str,
    file: UploadFile = File(...),
    uid: str = Depends(get_current_user_uid),
):
    """
    Upload a receipt / service-report image.
    - Stores the image in Supabase Storage (bucket: receipts).
    - Extracts structured fields via Claude Vision.
    - Returns { receipt_image_url, extracted: { event_type, event_date, mileage, cost, vendor, notes } }.

    The client pre-fills the maintenance-event form with the extracted data,
    then POSTs to /{car_id}/events including receipt_image_url.
    """
    try:
        maintenance_service.ensure_car_ownership(uid, car_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)

    image_bytes = await file.read()
    mime_type = file.content_type or "image/jpeg"

    try:
        result = receipt_service.scan_receipt(image_bytes, mime_type, car_id)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)

    return result
