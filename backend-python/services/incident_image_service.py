import mimetypes
import os
import uuid
from typing import Any, Optional

from fastapi import UploadFile

from config.database import get_supabase
from exceptions import NotFoundError, ValidationError
from repositories import car_repository, incident_image_repository, incident_repository

DEFAULT_ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
DEFAULT_SIGNED_URL_EXPIRES_SECONDS = 60 * 60
DEFAULT_BUCKET = "incident-attachments"


def _bucket_name() -> str:
    return (os.getenv("INCIDENT_IMAGES_BUCKET") or DEFAULT_BUCKET).strip() or DEFAULT_BUCKET


def _signed_url_expires_seconds() -> int:
    raw = (os.getenv("INCIDENT_IMAGES_SIGNED_URL_EXPIRES_SECONDS") or "").strip()
    if not raw:
        return DEFAULT_SIGNED_URL_EXPIRES_SECONDS
    try:
        val = int(raw)
    except ValueError:
        return DEFAULT_SIGNED_URL_EXPIRES_SECONDS
    return max(60, min(val, 60 * 60 * 24))


def _max_file_size_bytes() -> int:
    raw = (os.getenv("INCIDENT_IMAGES_MAX_FILE_SIZE_BYTES") or "").strip()
    if not raw:
        return DEFAULT_MAX_FILE_SIZE_BYTES
    try:
        val = int(raw)
    except ValueError:
        return DEFAULT_MAX_FILE_SIZE_BYTES
    return max(1, val)


def _allowed_mime_types() -> set[str]:
    raw = (os.getenv("INCIDENT_IMAGES_ALLOWED_MIME_TYPES") or "").strip()
    if not raw:
        return set(DEFAULT_ALLOWED_MIME_TYPES)
    allowed = {item.strip().lower() for item in raw.split(",") if item.strip()}
    return allowed or set(DEFAULT_ALLOWED_MIME_TYPES)


def _ext_for(content_type: Optional[str], filename: Optional[str]) -> str:
    if content_type:
        ext = mimetypes.guess_extension(content_type.split(";")[0].strip().lower())
        if ext:
            return ext
    if filename:
        _, ext = os.path.splitext(filename)
        if ext and len(ext) <= 8:
            return ext.lower()
    return ".jpg"


async def upload_images_for_incident(
    *,
    uid: str,
    car_id: str,
    incident_id: str,
    files: list[UploadFile],
) -> list[dict[str, Any]]:
    _ensure_owner_and_incident(uid=uid, car_id=car_id, incident_id=incident_id)
    if not files:
        return []

    allowed_types = _allowed_mime_types()
    max_bytes = _max_file_size_bytes()
    bucket = _bucket_name()

    out: list[dict[str, Any]] = []
    for f in files:
        ct = (f.content_type or "").lower()
        if not ct or ct not in allowed_types:
            raise ValidationError("Unsupported image type")

        raw = await f.read()
        if not raw:
            raise ValidationError("Image is empty")
        if len(raw) > max_bytes:
            raise ValidationError("Image is too large")

        ext = _ext_for(ct, f.filename)
        storage_path = f"incidents/{car_id}/{incident_id}/{uuid.uuid4().hex}{ext}"

        try:
            # storage3 expects bytes-like `file` arg.
            get_supabase().storage.from_(bucket).upload(
                path=storage_path,
                file=raw,
                file_options={"content-type": ct, "upsert": False},
            )
        except Exception as exc:
            raise ValidationError(f"Failed to upload image: {exc}") from exc

        row = incident_image_repository.insert_image(
            {
                "incident_id": incident_id,
                "storage_path": storage_path,
                "content_type": ct,
                "byte_size": len(raw),
            }
        )
        if not row:
            raise ValidationError("Failed to save incident image metadata")

        out.append(_row_with_signed_url(row))

    return out


def list_images_for_incident(*, uid: str, car_id: str, incident_id: str) -> list[dict[str, Any]]:
    _ensure_owner_and_incident(uid=uid, car_id=car_id, incident_id=incident_id)
    rows = incident_image_repository.list_images_for_incident(incident_id)
    return [_row_with_signed_url(r) for r in rows]


def get_public_image_bytes(image_id: str) -> tuple[bytes, str]:
    image_row = incident_image_repository.get_image(image_id)
    if not image_row:
        raise NotFoundError("Image not found")

    incident = incident_repository.get_incident(image_row["incident_id"])
    if not incident:
        raise NotFoundError("Incident not found")

    car = car_repository.get_car_by_id(incident["car_id"])
    if not car or not car.get("public_history"):
        raise NotFoundError("Not found")

    bucket = _bucket_name()
    storage_path = image_row["storage_path"]
    try:
        res = get_supabase().storage.from_(bucket).download(storage_path)
    except Exception as exc:
        raise NotFoundError("Image not found") from exc

    # storage3 returns bytes
    content_type = (image_row.get("content_type") or "application/octet-stream").strip()
    return res, content_type


def _row_with_signed_url(row: dict[str, Any]) -> dict[str, Any]:
    bucket = _bucket_name()
    expires = _signed_url_expires_seconds()
    signed = get_supabase().storage.from_(bucket).create_signed_url(row["storage_path"], expires)
    return {
        "id": row["id"],
        "incident_id": row["incident_id"],
        "storage_path": row["storage_path"],
        "content_type": row.get("content_type"),
        "byte_size": row.get("byte_size"),
        "created_at": row.get("created_at"),
        "url": signed.get("signedURL") or signed.get("signedUrl") or signed.get("signed_url"),
    }


def _ensure_owner_and_incident(*, uid: str, car_id: str, incident_id: str) -> None:
    car = car_repository.get_car_by_id_and_user(car_id, uid)
    if not car:
        raise NotFoundError("Car not found")
    incident = incident_repository.get_incident(incident_id)
    if not incident or incident.get("car_id") != car_id:
        raise NotFoundError("Incident not found")

