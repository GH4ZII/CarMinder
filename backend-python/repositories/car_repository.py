from typing import Any, cast

from config.database import get_supabase


def get_car_by_id_and_user(car_id: str, uid: str) -> dict[str, Any] | None:
    result = (
        get_supabase()
        .table("cars")
        .select("*")
        .eq("id", car_id)
        .eq("firebase_user_id", uid)
        .execute()
    )
    data = cast(list[dict[str, Any]], result.data)
    return data[0] if data else None


def get_cars_by_user(uid: str) -> list[dict[str, Any]]:
    result = (
        get_supabase()
        .table("cars")
        .select("*")
        .eq("firebase_user_id", uid)
        .order("created_at", desc=True)
        .execute()
    )
    return cast(list[dict[str, Any]], result.data) or []


def car_exists_for_user(uid: str, registration_number: str) -> bool:
    result = (
        get_supabase()
        .table("cars")
        .select("id")
        .eq("firebase_user_id", uid)
        .eq("registreringsnummer", registration_number)
        .execute()
    )
    return bool(result.data)


def insert_car(car_data: dict[str, Any]) -> dict[str, Any] | None:
    result = get_supabase().table("cars").insert(car_data).execute()
    data = cast(list[dict[str, Any]], result.data)
    return data[0] if data else None


def update_car(car_id: str, update_data: dict[str, Any]) -> dict[str, Any] | None:
    result = (
        get_supabase()
        .table("cars")
        .update(update_data)
        .eq("id", car_id)
        .execute()
    )
    data = cast(list[dict[str, Any]], result.data)
    return data[0] if data else None


def delete_car(car_id: str) -> None:
    get_supabase().table("cars").delete().eq("id", car_id).execute()
