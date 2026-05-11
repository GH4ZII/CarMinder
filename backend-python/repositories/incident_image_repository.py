from typing import Any, cast

from config.database import get_supabase


def list_images_for_incident(incident_id: str) -> list[dict[str, Any]]:
    result = (
        get_supabase()
        .table("incident_report_images")
        .select("*")
        .eq("incident_id", incident_id)
        .order("created_at", desc=False)
        .execute()
    )
    return cast(list[dict[str, Any]], result.data) or []


def insert_image(row: dict[str, Any]) -> dict[str, Any] | None:
    result = get_supabase().table("incident_report_images").insert(row).execute()
    data = cast(list[dict[str, Any]], result.data)
    return data[0] if data else None


def get_image(image_id: str) -> dict[str, Any] | None:
    result = (
        get_supabase()
        .table("incident_report_images")
        .select("*")
        .eq("id", image_id)
        .limit(1)
        .execute()
    )
    data = cast(list[dict[str, Any]], result.data)
    return data[0] if data else None

