from typing import Any, cast

from config.database import get_supabase


def list_events_for_car(car_id: str) -> list[dict[str, Any]]:
    result = (
        get_supabase()
        .table("maintenance_events")
        .select("*")
        .eq("car_id", car_id)
        .order("event_date", desc=True)
        .order("created_at", desc=True)
        .execute()
    )
    return cast(list[dict[str, Any]], result.data) or []


def insert_event(row: dict[str, Any]) -> dict[str, Any] | None:
    result = get_supabase().table("maintenance_events").insert(row).execute()
    data = cast(list[dict[str, Any]], result.data)
    return data[0] if data else None
