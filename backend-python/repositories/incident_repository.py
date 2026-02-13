from typing import Any, cast

from config.database import get_supabase


def list_incidents_for_car(car_id: str) -> list[dict[str, Any]]:
    result = (
        get_supabase()
        .table("incident_reports")
        .select("*")
        .eq("car_id", car_id)
        .order("incident_date", desc=True)
        .order("created_at", desc=True)
        .execute()
    )
    return cast(list[dict[str, Any]], result.data) or []


def insert_incident(row: dict[str, Any]) -> dict[str, Any] | None:
    result = get_supabase().table("incident_reports").insert(row).execute()
    data = cast(list[dict[str, Any]], result.data)
    return data[0] if data else None
