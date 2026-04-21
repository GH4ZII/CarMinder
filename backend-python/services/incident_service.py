from typing import Any

from exceptions import NotFoundError, ValidationError
from repositories import car_repository, incident_repository
from schemas.incident_report import IncidentReportCreate
from services import storage_service


def list_incidents(uid: str, car_id: str) -> list[dict[str, Any]]:
    _ensure_car_ownership(uid, car_id)
    incidents = incident_repository.list_incidents_for_car(car_id)
    return [_serialize_incident_attachments(incident) for incident in incidents]


def create_incident(
    uid: str,
    car_id: str,
    payload: IncidentReportCreate,
    *,
    before_image=None,
    after_image=None,
    receipt_pdf=None,
) -> dict[str, Any]:
    _ensure_car_ownership(uid, car_id)

    repair_cost_cents = None
    if payload.repair_cost is not None:
        repair_cost_cents = max(0, int(round(payload.repair_cost * 100)))

    before_image_url = (
        storage_service.upload_incident_attachment(car_id, "before_image", before_image)
        if before_image is not None
        else None
    )
    after_image_url = (
        storage_service.upload_incident_attachment(car_id, "after_image", after_image)
        if after_image is not None
        else None
    )
    receipt_pdf_url = (
        storage_service.upload_incident_attachment(car_id, "receipt_pdf", receipt_pdf)
        if receipt_pdf is not None
        else None
    )

    row = {
        "car_id": car_id,
        "incident_date": payload.incident_date.isoformat(),
        "severity": payload.severity,
        "description": payload.description,
        "damage_description": payload.damage_description,
        "repair_status": payload.repair_status,
        "repair_cost_cents": repair_cost_cents,
        "repair_vendor": payload.repair_vendor,
        "insurance_claim": payload.insurance_claim,
        "mileage": payload.mileage,
        "before_image_url": before_image_url,
        "after_image_url": after_image_url,
        "receipt_pdf_url": receipt_pdf_url,
    }

    result = incident_repository.insert_incident(row)
    if not result:
        raise ValidationError("Failed to create incident report")
    return _serialize_incident_attachments(result)


def _ensure_car_ownership(uid: str, car_id: str) -> None:
    car = car_repository.get_car_by_id_and_user(car_id, uid)
    if not car:
        raise NotFoundError("Car not found")


def _serialize_incident_attachments(incident: dict[str, Any]) -> dict[str, Any]:
    serialized = dict(incident)
    serialized["before_image_url"] = storage_service.sign_incident_attachment_url(
        incident.get("before_image_url")
    )
    serialized["after_image_url"] = storage_service.sign_incident_attachment_url(
        incident.get("after_image_url")
    )
    serialized["receipt_pdf_url"] = storage_service.sign_incident_attachment_url(
        incident.get("receipt_pdf_url")
    )
    return serialized
