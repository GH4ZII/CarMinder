

from typing import List

from fastapi import APIRouter, Header, HTTPException

from config.database import get_supabase
from schemas.maintenance_event import (
    EVENT_TYPES,
    MaintenanceEventCreate,
    MaintenanceEventResponse,
)

router = APIRouter(prefix="/cars", tags=["maintenance"])
router_meta = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router_meta.get("/event-types")
def get_event_types():
    """Allowed event_type values. Thin client uses this for pickers."""
    return {"event_types": EVENT_TYPES}


def _verify_car_ownership(car_id: str, firebase_user_id: str) -> None:
    supabase = get_supabase()
    r = supabase.table("cars").select("id").eq("id", car_id).eq(
        "firebase_user_id", firebase_user_id
    ).single().execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Car not found")


@router.get("/{car_id}/events", response_model=List[MaintenanceEventResponse])
def list_events(
    car_id: str,
    firebase_user_id: str = Header(..., alias="firebase-user-id"),
):
    """List maintenance events for a car. Ownership enforced server-side."""
    _verify_car_ownership(car_id, firebase_user_id)
    supabase = get_supabase()
    r = supabase.table("maintenance_events").select("*").eq(
        "car_id", car_id
    ).order("event_date", desc=True).order("created_at", desc=True).execute()
    return r.data or []


@router.post("/{car_id}/events", response_model=MaintenanceEventResponse)
def create_event(
    car_id: str,
    payload: MaintenanceEventCreate,
    firebase_user_id: str = Header(..., alias="firebase-user-id"),
):
    """Append a maintenance event. Validates, normalizes, stores. Append-only."""
    _verify_car_ownership(car_id, firebase_user_id)

    cost_cents = None
    if payload.cost is not None:
        cost_cents = max(0, int(round(payload.cost * 100)))

    row = {
        "car_id": car_id,
        "event_type": payload.event_type,
        "event_date": payload.event_date.isoformat(),
        "mileage": payload.mileage,
        "cost_cents": cost_cents,
        "vendor": payload.vendor,
        "notes": payload.notes,
    }

    supabase = get_supabase()
    r = supabase.table("maintenance_events").insert(row).execute()
    if not r.data:
        raise HTTPException(status_code=400, detail="Failed to create event")
    return r.data[0]
