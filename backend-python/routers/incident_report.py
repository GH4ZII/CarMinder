from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile

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
async def create_incident(car_id: str, request: Request, uid: str = Depends(get_current_user_uid)):
    try:
        payload, attachments = await _parse_incident_request(request)
        return incident_service.create_incident(uid, car_id, payload, **attachments)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)


async def _parse_incident_request(
    request: Request,
) -> tuple[IncidentReportCreate, dict[str, UploadFile | None]]:
    content_type = request.headers.get("content-type", "").lower()
    if "application/json" in content_type:
        data = await request.json()
        return IncidentReportCreate(**data), {
            "before_image": None,
            "after_image": None,
            "receipt_pdf": None,
        }

    form = await request.form()
    payload = IncidentReportCreate(
        incident_date=_normalize_form_value(form.get("incident_date")),
        severity=_normalize_form_value(form.get("severity")),
        description=_normalize_form_value(form.get("description")),
        damage_description=_normalize_form_value(form.get("damage_description")),
        repair_status=_normalize_form_value(form.get("repair_status")) or "not_repaired",
        repair_cost=_parse_optional_float(form.get("repair_cost")),
        repair_vendor=_normalize_form_value(form.get("repair_vendor")),
        insurance_claim=_parse_bool(form.get("insurance_claim")),
        mileage=_parse_optional_int(form.get("mileage")),
    )
    return payload, {
        "before_image": _as_upload(form.get("before_image")),
        "after_image": _as_upload(form.get("after_image")),
        "receipt_pdf": _as_upload(form.get("receipt_pdf")),
    }


def _normalize_form_value(value: Any) -> Any:
    if value is None or isinstance(value, UploadFile):
        return None
    stripped = str(value).strip()
    return stripped or None


def _parse_optional_int(value: Any) -> int | None:
    normalized = _normalize_form_value(value)
    if normalized is None:
        return None
    return int(str(normalized))


def _parse_optional_float(value: Any) -> float | None:
    normalized = _normalize_form_value(value)
    if normalized is None:
        return None
    return float(str(normalized))


def _parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    normalized = (_normalize_form_value(value) or "").lower()
    return normalized in {"1", "true", "yes", "on"}


def _as_upload(value: Any) -> UploadFile | None:
    if value is None:
        return None
    if getattr(value, "filename", None) and hasattr(value, "file"):
        return value
    return None
