import logging
from io import BytesIO
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from xhtml2pdf import pisa

from config.auth import get_current_user_uid
from exceptions import AlreadyExistsError, NotFoundError, ValidationError
from schemas.car import (
    CarCreate,
    CarResponse,
    CarUpdate,
    ClaimRequest,
    KilometerUpdate,
    TransferResponse,
    VehicleLookupRequest,
    VehicleLookupResponse,
)
from services import car_report_service, car_service

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


@router.get("/{car_id}/report.pdf")
def generate_car_report_pdf(car_id: str, uid: str = Depends(get_current_user_uid)) -> Response:
    """
    Generate a PDF car report for the given car and authenticated user.
    """
    try:
        html = car_report_service.generate_car_report_html(uid, car_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except Exception:
        logging.getLogger(__name__).exception("Report HTML generation failed for car_id=%s", car_id)
        raise HTTPException(status_code=500, detail="Failed to generate PDF")

    try:
        pdf_buffer = BytesIO()
        pisa_status = pisa.CreatePDF(html, dest=pdf_buffer)
        if pisa_status.err:
            raise HTTPException(status_code=500, detail="Failed to generate PDF")
        pdf_bytes = pdf_buffer.getvalue()
    except HTTPException:
        raise
    except Exception:
        logging.getLogger(__name__).exception("PDF generation failed for car_id=%s", car_id)
        raise HTTPException(status_code=500, detail="Failed to generate PDF")

    headers = {
        "Content-Disposition": f'attachment; filename="car-report-{car_id}.pdf"'
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@router.post("/{car_id}/transfer", response_model=TransferResponse)
def initiate_transfer(car_id: str, uid: str = Depends(get_current_user_uid)):
    try:
        return car_service.initiate_transfer(uid, car_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/claim", response_model=CarResponse)
def claim_car(body: ClaimRequest, uid: str = Depends(get_current_user_uid)):
    try:
        return car_service.claim_car(uid, body.transfer_code)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.delete("/{car_id}/transfer")
def cancel_transfer(car_id: str, uid: str = Depends(get_current_user_uid)):
    try:
        car_service.cancel_transfer(uid, car_id)
        return {"message": "Transfer cancelled"}
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)
