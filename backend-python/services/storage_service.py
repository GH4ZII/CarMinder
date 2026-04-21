from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from config.database import get_supabase
from config.settings import get_settings
from exceptions import ValidationError

DEFAULT_BUCKET = "incident-attachments"
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

    return get_supabase().storage.from_(bucket_name).get_public_url(path)
