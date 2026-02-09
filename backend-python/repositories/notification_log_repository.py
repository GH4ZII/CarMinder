from config.database import get_supabase


def has_been_sent(car_id: str, notification_type: str) -> bool:
    """Check if a specific notification has already been sent for a car."""
    result = (
        get_supabase()
        .table("notification_log")
        .select("id")
        .eq("car_id", car_id)
        .eq("notification_type", notification_type)
        .execute()
    )
    return bool(result.data)


def record_sent(car_id: str, notification_type: str) -> None:
    """Record that a notification was sent."""
    get_supabase().table("notification_log").upsert(
        {"car_id": car_id, "notification_type": notification_type},
        on_conflict="car_id,notification_type",
    ).execute()
