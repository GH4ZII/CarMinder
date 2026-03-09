from typing import Any, cast

from config.database import get_supabase


def insert_reading(row: dict[str, Any]) -> dict[str, Any] | None:
    result = get_supabase().table("obd_readings").insert(row).execute()
    data = cast(list[dict[str, Any]], result.data)
    return data[0] if data else None


def get_latest_reading(car_id: str) -> dict[str, Any] | None:
    result = (
        get_supabase()
        .table("obd_readings")
        .select("*")
        .eq("car_id", car_id)
        .order("captured_at", desc=True)
        .limit(1)
        .execute()
    )
    data = cast(list[dict[str, Any]], result.data)
    return data[0] if data else None


def list_readings_for_car(car_id: str, limit: int = 50) -> list[dict[str, Any]]:
    result = (
        get_supabase()
        .table("obd_readings")
        .select("*")
        .eq("car_id", car_id)
        .order("captured_at", desc=True)
        .limit(limit)
        .execute()
    )
    return cast(list[dict[str, Any]], result.data) or []
