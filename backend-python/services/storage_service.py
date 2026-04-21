from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import UploadFile

from config.database import get_supabase
from config.settings import get_settings
from exceptions import ValidationError

DEFAULT_BUCKET = "incident-attachments"
SIGNED_URL_TTL_SECONDS = 60 * 60
IMAGE_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
}
PDF_MIME_TYPES = {"application/pdf": ".pdf"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_PDF_BYTES = 15 * 1024 * 1024


def upload_incident_attachment(car_id: str, attachment_kind: str, file: UploadFile) -> str:
    content_type = (file.content_type or "").lower()
    filename = file.filename or f"{attachment_kind}"

    if attachment_kind in {"before_image", "after_image"}:
        allowed_types = IMAGE_MIME_TYPES
        max_bytes = MAX_IMAGE_BYTES
    elif attachment_kind == "receipt_pdf":
        allowed_types = PDF_MIME_TYPES
        max_bytes = MAX_PDF_BYTES
    else:  # pragma: no cover - defensive branch
        raise ValidationError("Unsupported incident attachment type")

    extension = allowed_types.get(content_type)
    if extension is None:
        suffix = Path(filename).suffix.lower()
        if suffix and suffix in allowed_types.values():
            extension = suffix
        else:
            expected = "PDF" if attachment_kind == "receipt_pdf" else "image"
            raise ValidationError(f"{attachment_kind} must be a valid {expected} file")

    content = file.file.read()
    if not content:
        raise ValidationError(f"{attachment_kind} is empty")
    if len(content) > max_bytes:
        limit_mb = max_bytes // (1024 * 1024)
        raise ValidationError(f"{attachment_kind} exceeds the {limit_mb} MB size limit")

    path = f"{car_id}/{uuid4().hex}_{attachment_kind}{extension}"
    bucket_name = get_settings().get("SUPABASE_INCIDENT_ATTACHMENTS_BUCKET") or DEFAULT_BUCKET

    try:
        get_supabase().storage.from_(bucket_name).upload(
            path,
            content,
            {"content-type": content_type or "application/octet-stream"},
        )
    except Exception as exc:  # pragma: no cover - storage client errors vary
        raise ValidationError(f"Failed to upload {attachment_kind}") from exc

    return path


def sign_incident_attachment_url(stored_value: str | None) -> str | None:
    if not stored_value:
        return None

    bucket_name = get_settings().get("SUPABASE_INCIDENT_ATTACHMENTS_BUCKET") or DEFAULT_BUCKET
    path = _extract_object_path(stored_value, bucket_name)
    if not path:
        return None

    try:
        response = get_supabase().storage.from_(bucket_name).create_signed_url(
            path,
            SIGNED_URL_TTL_SECONDS,
        )
    except Exception:  # pragma: no cover - storage client errors vary
        return None

    signed_url = getattr(response, "signedURL", None) or getattr(response, "signedUrl", None)
    if isinstance(signed_url, str) and signed_url:
        return signed_url
    return None


def _extract_object_path(stored_value: str, bucket_name: str) -> str | None:
    if stored_value.startswith("http://") or stored_value.startswith("https://"):
        parsed = urlparse(stored_value)
        marker = f"/object/public/{bucket_name}/"
        signed_marker = f"/object/sign/{bucket_name}/"
        if marker in parsed.path:
            return parsed.path.split(marker, 1)[1]
        if signed_marker in parsed.path:
            return parsed.path.split(signed_marker, 1)[1]
        return None
    return stored_value.lstrip("/")
