from typing import Any, cast

from config.database import get_supabase


def upsert_push_token(firebase_user_id: str, expo_push_token: str) -> dict[str, Any] | None:
    """Insert or update a push token for a user."""
    result = (
        get_supabase()
        .table("push_tokens")
        .upsert(
            {
                "firebase_user_id": firebase_user_id,
                "expo_push_token": expo_push_token,
            },
            on_conflict="firebase_user_id,expo_push_token",
        )
        .execute()
    )
    data = cast(list[dict[str, Any]], result.data)
    return data[0] if data else None


def get_tokens_for_user(firebase_user_id: str) -> list[str]:
    """Get all push tokens for a user."""
    result = (
        get_supabase()
        .table("push_tokens")
        .select("expo_push_token")
        .eq("firebase_user_id", firebase_user_id)
        .execute()
    )
    data = cast(list[dict[str, Any]], result.data) or []
    return [row["expo_push_token"] for row in data]


def delete_push_token(expo_push_token: str) -> None:
    """Remove a specific push token (e.g., when user signs out)."""
    get_supabase().table("push_tokens").delete().eq("expo_push_token", expo_push_token).execute()


def get_all_users_with_tokens() -> list[dict[str, Any]]:
    """Get all distinct users who have push tokens registered."""
    result = (
        get_supabase()
        .table("push_tokens")
        .select("firebase_user_id, expo_push_token")
        .execute()
    )
    return cast(list[dict[str, Any]], result.data) or []
