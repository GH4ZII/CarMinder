"""
Input normalization for the scoring engine.

Converts raw database dictionaries into canonical typed dataclasses
that the pure scoring engine expects.  All unknown/invalid enum values
are mapped to safe defaults so the engine never receives garbage.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Canonical enum values
# ---------------------------------------------------------------------------

MAINTENANCE_EVENT_TYPES = frozenset(
    {"oil_change", "brake_service", "tire_change", "inspection", "repair", "other"}
)

SEVERITY_LEVELS = frozenset({"minor", "moderate", "severe"})
DEFAULT_SEVERITY = "minor"

REPAIR_STATUSES = frozenset(
    {"not_repaired", "partially_repaired", "fully_repaired"}
)
DEFAULT_REPAIR_STATUS = "not_repaired"


# ---------------------------------------------------------------------------
# Canonical data structures consumed by the engine
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class CarData:
    """Normalized car fields relevant to scoring."""

    first_registration_date: Optional[date]
    current_km: int
    eu_deadline: Optional[str]  # ISO-date string or None
    brand: str
    model: str


@dataclass(frozen=True, slots=True)
class MaintenanceEventData:
    """Normalized maintenance event."""

    id: str
    event_type: str  # canonical value from MAINTENANCE_EVENT_TYPES
    event_date: date
    mileage: Optional[int]
    cost_cents: Optional[int]
    vendor: Optional[str]
    notes: Optional[str]
    receipt_image_url: Optional[str]


@dataclass(frozen=True, slots=True)
class IncidentData:
    """Normalized incident report."""

    id: str
    severity: str  # canonical value from SEVERITY_LEVELS
    repair_status: str  # canonical value from REPAIR_STATUSES
    incident_date: date
    mileage: Optional[int]
    damage_description: Optional[str]
    repair_cost_cents: Optional[int]
    repair_vendor: Optional[str]
    insurance_claim: bool


@dataclass(frozen=True, slots=True)
class ServiceInterval:
    """Expected interval for one service type."""

    months: Optional[int]
    km: Optional[int]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_date(value: Any) -> Optional[date]:
    """Parse an ISO-date string, returning None on any failure."""
    if not value or value == "Unknown":
        return None
    try:
        return date.fromisoformat(str(value))
    except (ValueError, TypeError):
        return None


def _safe_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def _safe_optional_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def _safe_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def _canonical_event_type(raw: Any) -> str:
    val = str(raw).strip().lower() if raw else "other"
    return val if val in MAINTENANCE_EVENT_TYPES else "other"


def _canonical_severity(raw: Any) -> str:
    val = str(raw).strip().lower() if raw else DEFAULT_SEVERITY
    return val if val in SEVERITY_LEVELS else DEFAULT_SEVERITY


def _canonical_repair_status(raw: Any) -> str:
    val = str(raw).strip().lower() if raw else DEFAULT_REPAIR_STATUS
    return val if val in REPAIR_STATUSES else DEFAULT_REPAIR_STATUS


# ---------------------------------------------------------------------------
# Public normalizers
# ---------------------------------------------------------------------------

def normalize_car(raw: dict[str, Any]) -> CarData:
    """Convert a raw Supabase car row into canonical CarData."""
    return CarData(
        first_registration_date=_safe_date(raw.get("forstegangregistrert")),
        current_km=_safe_int(raw.get("kilometer"), 0),
        eu_deadline=raw.get("eukontrollfrist") or None,
        brand=str(raw.get("merke", "")).strip(),
        model=str(raw.get("modell", "")).strip(),
    )


def normalize_event(raw: dict[str, Any], fallback_date: date) -> MaintenanceEventData:
    """Convert a raw Supabase maintenance_event row into canonical form."""
    parsed = _safe_date(raw.get("event_date"))
    return MaintenanceEventData(
        id=str(raw.get("id", "")),
        event_type=_canonical_event_type(raw.get("event_type")),
        event_date=parsed if parsed is not None else fallback_date,
        mileage=_safe_optional_int(raw.get("mileage")),
        cost_cents=_safe_optional_int(raw.get("cost_cents")),
        vendor=_safe_str(raw.get("vendor")),
        notes=_safe_str(raw.get("notes")),
        receipt_image_url=_safe_str(raw.get("receipt_image_url")),
    )


def normalize_incident(raw: dict[str, Any], fallback_date: date) -> IncidentData:
    """Convert a raw Supabase incident_report row into canonical form."""
    parsed = _safe_date(raw.get("incident_date"))
    return IncidentData(
        id=str(raw.get("id", "")),
        severity=_canonical_severity(raw.get("severity")),
        repair_status=_canonical_repair_status(raw.get("repair_status")),
        incident_date=parsed if parsed is not None else fallback_date,
        mileage=_safe_optional_int(raw.get("mileage")),
        damage_description=_safe_str(raw.get("damage_description")),
        repair_cost_cents=_safe_optional_int(raw.get("repair_cost_cents")),
        repair_vendor=_safe_str(raw.get("repair_vendor")),
        insurance_claim=bool(raw.get("insurance_claim", False)),
    )


def normalize_intervals(
    raw: dict[str, dict[str, Optional[int]]],
) -> dict[str, ServiceInterval]:
    """Convert the DEFAULT_INTERVALS dict into typed ServiceInterval map."""
    return {
        k: ServiceInterval(months=v.get("months"), km=v.get("km"))
        for k, v in raw.items()
    }
