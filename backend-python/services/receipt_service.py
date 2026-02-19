"""
Receipt scanning service — Tesseract OCR + regex parsing (no LLM).

Pipeline:
  1. Validate MIME type and file size.
  2. Pre-process the image with Pillow (greyscale, contrast boost) for better OCR.
  3. Run Tesseract OCR to extract raw text.
  4. Parse the raw text with deterministic regex patterns to extract:
       event_type, event_date, mileage, cost, vendor, notes.
  5. Upload the original image to Supabase Storage (bucket: receipts).
  6. Return { receipt_image_url, extracted }.
"""

from __future__ import annotations

import io
import re
import uuid
from datetime import date
from typing import Any

import pytesseract
from PIL import Image, ImageEnhance, ImageFilter

from config.database import get_supabase
from config.settings import get_settings
from exceptions import ValidationError

# ── Constants ────────────────────────────────────────────────────────────────

BUCKET = "receipts"

ALLOWED_MIME: set[str] = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}

_MIME_EXT: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
}

MAX_BYTES = 10 * 1024 * 1024  # 10 MB


# ── Image pre-processing ──────────────────────────────────────────────────────

def _preprocess_for_ocr(image_bytes: bytes) -> Image.Image:
    """
    Convert to greyscale and boost contrast so Tesseract reads printed text better.
    Works well for receipts printed on thermal paper or scanned invoices.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("L")  # greyscale

    # Upscale small images — Tesseract needs at least ~300 DPI equivalent
    w, h = img.size
    if max(w, h) < 1500:
        scale = 1500 / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    # Sharpen edges and boost contrast
    img = img.filter(ImageFilter.SHARPEN)
    img = ImageEnhance.Contrast(img).enhance(2.0)

    return img


def _run_ocr(image_bytes: bytes) -> str:
    """Return raw OCR text from the image."""
    img = _preprocess_for_ocr(image_bytes)
    # PSM 6 = assume a single uniform block of text (good for receipts)
    text: str = pytesseract.image_to_string(img, config="--psm 6")
    return text


# ── Regex parsers ─────────────────────────────────────────────────────────────

# -- Event type keyword mapping (order matters: more specific first)
_EVENT_TYPE_KEYWORDS: list[tuple[str, list[str]]] = [
    ("oil_change",    ["oil change", "oil service", "engine oil", "oil filter",
                       "oljeskift", "motorolje", "oljebytte"]),
    ("brake_service", ["brake", "brakes", "bremse", "bremser", "brake pad",
                       "brake disc", "rotor", "caliper"]),
    ("tire_change",   ["tire", "tyre", "tyres", "tires", "dekk", "wheel",
                       "dekskift", "tire rotation", "tire balance"]),
    ("inspection",    ["inspection", "service inspection", "annual service",
                       "eu kontroll", "eu-kontroll", "periodisk kontroll",
                       "general service", "full service"]),
    ("repair",        ["repair", "reparation", "reparasjon", "fix", "replaced",
                       "replacement", "diagnos", "diagnosis"]),
]


def _parse_event_type(text: str) -> str:
    lower = text.lower()
    for event_type, keywords in _EVENT_TYPE_KEYWORDS:
        if any(kw in lower for kw in keywords):
            return event_type
    return "other"


# Date patterns tried in order of preference
_DATE_PATTERNS: list[tuple[str, str]] = [
    # ISO: 2024-03-15
    (r"\b(\d{4})[-/\.](\d{1,2})[-/\.](\d{1,2})\b", "{0}-{1:0>2}-{2:0>2}"),
    # European: 15.03.2024 or 15/03/2024 or 15-03-2024
    (r"\b(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{4})\b", "{2}-{1:0>2}-{0:0>2}"),
    # Short year: 15.03.24
    (r"\b(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{2})\b", "20{2}-{1:0>2}-{0:0>2}"),
]


def _parse_date(text: str) -> str | None:
    today = date.today()
    for pattern, fmt in _DATE_PATTERNS:
        for m in re.finditer(pattern, text):
            groups = m.groups()
            try:
                # Build the date string using the format template
                date_str = fmt.format(*groups)
                parsed = date.fromisoformat(date_str)
                if parsed <= today:
                    return parsed.isoformat()
            except (ValueError, IndexError):
                continue
    return None


# Mileage: keyword label followed by a large integer, optionally followed by km/miles.
# The label-first approach avoids false positives from part numbers, zip codes etc.
_MILEAGE_PATTERNS = [
    # Label before the number: "km-stand: 45 230" / "odometer: 45230 km"
    r"(?:km.?stand|odometer|mileage|kilometer|km|kjørt|driven)[:\s]+(\d[\d\s]{2,7})\s*(?:km|miles?|mil)?\b",
    # Number before the unit, 4-7 digits (prevents short part numbers matching)
    r"\b(\d{4,7})\s*km\b",
    r"\b(\d{4,7})\s*miles?\b",
]


def _parse_mileage(text: str) -> int | None:
    lower = text.lower()
    for pattern in _MILEAGE_PATTERNS:
        for m in re.finditer(pattern, lower):
            raw = re.sub(r"\s", "", m.group(1))  # strip internal spaces (45 230 → 45230)
            try:
                km = int(raw)
                if 1_000 <= km <= 9_999_999:  # sanity: 1 000 – 9.9M km
                    return km
            except ValueError:
                continue
    return None


def _normalise_amount(raw: str, cents_group: str | None = None) -> float | None:
    """
    Convert messy currency strings to a clean float.
    Handles:
      "1 299,00"  → 1299.00
      "1.299,00"  → 1299.00
      "1,299.00"  → 1299.00
      "838,00"    → 838.00
      "838.00"    → 838.00
    """
    raw = raw.strip()

    # If a separate cents group was captured (e.g. from pattern group 2), use it directly
    if cents_group is not None:
        integer_part = re.sub(r"[\s.,]", "", raw)
        try:
            return round(float(f"{integer_part}.{cents_group}"), 2)
        except ValueError:
            return None

    # Remove whitespace (thousands separator in some locales)
    raw = re.sub(r"\s", "", raw)

    # Detect decimal separator: if the last separator is ',' followed by exactly 2 digits → comma decimal
    # e.g. "1.299,00" or "838,00"
    comma_decimal = re.search(r",(\d{2})$", raw)
    dot_decimal   = re.search(r"\.(\d{2})$", raw)

    if comma_decimal:
        # Remove dots (thousands sep) and replace trailing comma with dot
        raw = raw.replace(".", "").replace(",", ".")
    elif dot_decimal:
        # Remove commas (thousands sep), keep dot decimal
        raw = raw.replace(",", "")
    else:
        # No clear decimal — strip all separators and treat as integer
        raw = re.sub(r"[,.]", "", raw)

    try:
        return round(float(raw), 2)
    except ValueError:
        return None


# Cost: anchor to total/sum labels for precision; also catch bare "X,XX" money amounts
_COST_PATTERNS: list[tuple[str, bool]] = [
    # Label + amount on the same line (group 1 = amount string)
    (r"(?:total|sum|betalt|å\s*betale|inkl\.?\s*mva|amount\s*due|grand\s*total)"
     r"[:\s]+([0-9][0-9\s.,]{1,12})", False),
    # "1 299,00" or "1299.00" with clear decimal — two-group capture
    (r"\b([1-9]\d{1,5})[,.](\d{2})\b", True),  # True = has cents group
]


def _parse_cost(text: str) -> float | None:
    lower = text.lower()
    for pattern, has_cents_group in _COST_PATTERNS:
        for m in re.finditer(pattern, lower):
            cents = m.group(2) if has_cents_group and len(m.groups()) >= 2 else None
            value = _normalise_amount(m.group(1), cents)
            if value is not None and 1.0 <= value <= 9_999_999.0:
                return value
    return None


def _parse_vendor(text: str) -> str | None:
    """
    The vendor / workshop name is almost always in the first few lines.
    Take the first non-empty line that is ≥ 4 chars and not purely numeric.
    """
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for line in lines[:6]:
        # Skip lines that look like addresses, dates, or phone numbers
        if re.match(r"^[\d\W]+$", line):
            continue
        if len(line) < 4:
            continue
        return line[:100]
    return None


def _build_notes(text: str, event_type: str) -> str | None:
    """
    Build a short summary from lines that mention work performed.
    Collects up to 3 meaningful content lines and joins them.
    """
    work_keywords = [
        "replace", "changed", "installed", "removed", "cleaned", "adjusted",
        "repaired", "flushed", "rotated", "balanced", "aligned", "checked",
        "service", "bytte", "skifte", "monter", "reparert",
    ]
    summary_lines: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if len(stripped) < 8:
            continue
        if any(kw in stripped.lower() for kw in work_keywords):
            summary_lines.append(stripped)
        if len(summary_lines) >= 3:
            break

    if summary_lines:
        return "; ".join(summary_lines)[:300]

    # Fallback: just describe the event type
    label = event_type.replace("_", " ").capitalize()
    return f"{label} service"


# ── Storage upload ────────────────────────────────────────────────────────────

def _upload_to_storage(image_bytes: bytes, mime_type: str, car_id: str) -> str:
    """Upload to Supabase Storage. Returns public URL."""
    ext = _MIME_EXT.get(mime_type, "jpg")
    filename = f"{car_id}/{uuid.uuid4()}.{ext}"

    get_supabase().storage.from_(BUCKET).upload(
        path=filename,
        file=image_bytes,
        file_options={"content-type": mime_type, "upsert": "false"},
    )

    supabase_url = get_settings()["SUPABASE_URL"] or ""
    return f"{supabase_url}/storage/v1/object/public/{BUCKET}/{filename}"


# ── Public API ────────────────────────────────────────────────────────────────

def scan_receipt(image_bytes: bytes, mime_type: str, car_id: str) -> dict[str, Any]:
    """
    Full pipeline:
      1. Validate input.
      2. Run Tesseract OCR on the pre-processed image.
      3. Extract fields with deterministic regex parsers.
      4. Upload the original image to Supabase Storage.
      5. Return { receipt_image_url, extracted }.

    Raises ValidationError on bad input.
    No LLM / external AI API required.
    """
    if mime_type not in ALLOWED_MIME:
        raise ValidationError(
            f"Unsupported image type '{mime_type}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_MIME))}"
        )

    if len(image_bytes) > MAX_BYTES:
        raise ValidationError("Image file is too large (max 10 MB)")

    # OCR
    try:
        raw_text = _run_ocr(image_bytes)
    except Exception as exc:
        raise ValidationError(f"OCR failed: {exc}") from exc

    # Parse each field independently — a failure on one never blocks others
    event_type = _parse_event_type(raw_text)
    event_date = _parse_date(raw_text)
    mileage    = _parse_mileage(raw_text)
    cost       = _parse_cost(raw_text)
    vendor     = _parse_vendor(raw_text)
    notes      = _build_notes(raw_text, event_type)

    # Upload image (storage errors propagate up — they are real failures)
    receipt_image_url = _upload_to_storage(image_bytes, mime_type, car_id)

    return {
        "receipt_image_url": receipt_image_url,
        "extracted": {
            "event_type": event_type,
            "event_date": event_date,
            "mileage":    mileage,
            "cost":       cost,
            "vendor":     vendor,
            "notes":      notes,
        },
    }
