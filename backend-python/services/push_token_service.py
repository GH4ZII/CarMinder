"""
Application service for push-token operations and notification cron checks.
"""
from typing import Any, Optional

from config.settings import get_settings
from repositories import push_token_repository
from services import notification_service


def register_push_token(uid: str, expo_push_token: str) -> None:
    push_token_repository.upsert_push_token(uid, expo_push_token)


def unregister_push_token(expo_push_token: str) -> None:
    push_token_repository.delete_push_token(expo_push_token)


async def check_deadlines(x_cron_secret: Optional[str]) -> dict[str, Any]:
    settings = get_settings()
    expected_secret = settings.get("CRON_SECRET")
    if expected_secret and x_cron_secret != expected_secret:
        raise PermissionError("Invalid cron secret")

    return await notification_service.check_and_send_eu_control_reminders()
