import io
import re
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional

import pytesseract
from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError
from dateutil import parser as date_parser

from config.settings import get_settings
from exceptions import ValidationError
from schemas.ocr import OcrFieldConfidence, ReceiptOcrResponse

DEFAULT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
DEFAULT_ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
DEFAULT_OCR_LANG = "eng+nor"


async def extract_receipt_data(image_file: UploadFile) -> ReceiptOcrResponse:
    settings = get_settings()
    _configure_tesseract(settings)
    _validate_content_type(image_file.content_type, settings)

    raw_bytes = await image_file.read()
    _validate_file_size(raw_bytes, settings)
    text = _extract_text(raw_bytes, settings)
    if not text.strip():
        raise ValidationError("OCR could not read text from the image")

    event_date = _extract_date(text)
    cost = _extract_cost(text)
    vendor = _extract_vendor(text)
    mileage = _extract_mileage(text)
    notes = _extract_notes(text)

    confidence = OcrFieldConfidence(
        event_date=0.85 if event_date else None,
        cost=0.8 if cost is not None else None,
        vendor=0.7 if vendor else None,
        mileage=0.75 if mileage is not None else None,
        notes=0.55 if notes else None,
    )

    return ReceiptOcrResponse(
        event_date=event_date,
        cost=cost,
        vendor=vendor,
        notes=notes,
        mileage=mileage,
        confidence=confidence,
    )


def _configure_tesseract(settings: dict[str, str | None]) -> None:
    cmd = (settings.get("OCR_TESSERACT_CMD") or "").strip()
    if cmd:
        pytesseract.pytesseract.tesseract_cmd = cmd


def _validate_content_type(content_type: str | None, settings: dict[str, str | None]) -> None:
    allowed_raw = (settings.get("OCR_ALLOWED_MIME_TYPES") or "").strip()
    if allowed_raw:
        allowed = {item.strip().lower() for item in allowed_raw.split(",") if item.strip()}
    else:
        allowed = DEFAULT_ALLOWED_MIME_TYPES

    if not content_type or content_type.lower() not in allowed:
        raise ValidationError("Unsupported receipt image type")


def _validate_file_size(raw_bytes: bytes, settings: dict[str, str | None]) -> None:
    max_size_raw = (settings.get("OCR_MAX_FILE_SIZE_BYTES") or "").strip()
    try:
        max_size = int(max_size_raw) if max_size_raw else DEFAULT_MAX_FILE_SIZE_BYTES
    except ValueError as exc:
        raise ValidationError("Invalid OCR_MAX_FILE_SIZE_BYTES setting") from exc

    if len(raw_bytes) == 0:
        raise ValidationError("Receipt image is empty")
    if len(raw_bytes) > max_size:
        raise ValidationError("Receipt image is too large")


def _extract_text(raw_bytes: bytes, settings: dict[str, str | None]) -> str:
    lang = (settings.get("OCR_LANG") or DEFAULT_OCR_LANG).strip() or DEFAULT_OCR_LANG
    try:
        image = Image.open(io.BytesIO(raw_bytes))
        image = image.convert("L")
        return pytesseract.image_to_string(image, lang=lang)
    except UnidentifiedImageError as exc:
        raise ValidationError("Uploaded file is not a valid image") from exc
    except pytesseract.TesseractNotFoundError as exc:
        raise ValidationError("Tesseract OCR is not installed on the server") from exc
    except Exception as exc:
        raise ValidationError(f"OCR processing failed: {exc}") from exc


def _extract_date(text: str) -> Optional[date]:
    candidates = re.findall(r"\b\d{1,4}[./-]\d{1,2}[./-]\d{1,4}\b", text)
    for candidate in candidates:
        parsed = _try_parse_date(candidate)
        if parsed:
            return parsed
    return None


def _try_parse_date(raw_value: str) -> Optional[date]:
    try:
        parsed = date_parser.parse(raw_value, dayfirst=True, fuzzy=False).date()
    except (ValueError, OverflowError):
        return None
    if parsed > date.today():
        return None
    return parsed


def _extract_cost(text: str) -> Optional[float]:
    keyword_pattern = re.compile(
        r"(?im)(?:total|totalt|sum|belop|amount|to pay|a betale)[^\d]{0,20}(\d{1,6}(?:[.,]\d{1,2})?)"
    )
    keyword_match = keyword_pattern.search(text)
    if keyword_match:
        parsed = _parse_money(keyword_match.group(1))
        if parsed is not None:
            return parsed

    fallback_candidates = re.findall(r"\b\d{1,6}(?:[.,]\d{2})\b", text)
    parsed_fallback = [_parse_money(candidate) for candidate in fallback_candidates]
    parsed_values = [value for value in parsed_fallback if value is not None]
    if not parsed_values:
        return None
    return max(parsed_values)


def _parse_money(value: str) -> Optional[float]:
    normalized = value.replace(" ", "").replace(",", ".")
    try:
        parsed = Decimal(normalized)
    except InvalidOperation:
        return None
    if parsed < 0:
        return None
    return float(parsed.quantize(Decimal("0.01")))


def _extract_vendor(text: str) -> Optional[str]:
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if len(line) < 3:
            continue
        if re.search(r"\d{4,}", line):
            continue
        if re.search(r"(org|kvittering|receipt|dato|date|sum|total)", line, re.IGNORECASE):
            continue
        return line[:80]
    return None


def _extract_mileage(text: str) -> Optional[int]:
    mileage_pattern = re.compile(r"(?i)(?:mileage|odometer|km[- ]?stand|km)[^\d]{0,12}(\d{1,7})")
    match = mileage_pattern.search(text)
    if not match:
        return None
    try:
        value = int(match.group(1))
    except ValueError:
        return None
    return value if value >= 0 else None


def _extract_notes(text: str) -> Optional[str]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return None
    cleaned_lines = [line for line in lines if not re.fullmatch(r"[-=*_ ]{3,}", line)]
    if not cleaned_lines:
        return None
    summary = " | ".join(cleaned_lines[:4])
    return summary[:240]
