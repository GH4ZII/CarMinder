"""
Notification service for EU control deadline reminders.

Uses Expo Push Notifications API to send reminders at 30 days, 7 days,
and day-of thresholds before the eukontrollfrist deadline.
"""
import logging
from datetime import date
from typing import Any

import httpx

from repositories import car_repository, push_token_repository, notification_log_repository

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

NOTIFICATION_THRESHOLDS = [
    {
        "days": 30,
        "type": "eu_control_30d",
        "title": "EU Control in 30 days",
        "body_template": "{car_name} ({reg}) has EU control due on {due_date}. Book your appointment soon!",
    },
    {
        "days": 7,
        "type": "eu_control_7d",
        "title": "EU Control in 7 days",
        "body_template": "{car_name} ({reg}) has EU control due on {due_date}. Time is running out!",
    },
    {
        "days": 0,
        "type": "eu_control_today",
        "title": "EU Control is today!",
        "body_template": "{car_name} ({reg}) has EU control due TODAY ({due_date})!",
    },
]


async def _send_expo_push(token: str, title: str, body: str, data: dict | None = None) -> bool:
    """Send a single push notification via Expo Push API."""
    message = {
        "to": token,
        "sound": "default",
        "title": title,
        "body": body,
    }
    if data:
        message["data"] = data

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=message,
                headers={"Content-Type": "application/json"},
            )
            result = response.json()
            if response.status_code == 200:
                ticket_data = result.get("data", {})
                if ticket_data.get("status") == "error":
                    logger.warning("Push notification error: %s", ticket_data.get("message"))
                    return False
                return True
            logger.error("Expo Push API error: %s %s", response.status_code, result)
            return False
    except Exception:
        logger.exception("Failed to send push notification")
        return False


async def check_and_send_eu_control_reminders() -> dict[str, Any]:
    """
    Check all cars with push-token-registered owners for upcoming EU control deadlines.
    Send notifications at 30-day, 7-day, and day-of thresholds.
    """
    today = date.today()
    sent_count = 0
    skipped_count = 0
    error_count = 0

    # Get all users who have push tokens, grouped by user
    token_entries = push_token_repository.get_all_users_with_tokens()
    user_tokens: dict[str, list[str]] = {}
    for entry in token_entries:
        uid = entry["firebase_user_id"]
        token = entry["expo_push_token"]
        user_tokens.setdefault(uid, []).append(token)

    for uid, tokens in user_tokens.items():
        cars = car_repository.get_cars_by_user(uid)

        for car in cars:
            car_id = car.get("id")
            eukontrollfrist_str = car.get("eukontrollfrist")

            if not car_id or not eukontrollfrist_str or eukontrollfrist_str == "Unknown":
                continue

            try:
                due_date = date.fromisoformat(eukontrollfrist_str)
            except (ValueError, TypeError):
                continue

            days_until = (due_date - today).days
            car_name = f"{car.get('merke', '')} {car.get('modell', '')}".strip() or "Your car"
            reg = car.get("registreringsnummer", "")

            for threshold in NOTIFICATION_THRESHOLDS:
                if days_until > threshold["days"]:
                    continue

                notification_type = threshold["type"]

                if notification_log_repository.has_been_sent(car_id, notification_type):
                    skipped_count += 1
                    continue

                title = threshold["title"]
                body = threshold["body_template"].format(
                    car_name=car_name,
                    reg=reg,
                    due_date=eukontrollfrist_str,
                )

                for token in tokens:
                    success = await _send_expo_push(
                        token=token,
                        title=title,
                        body=body,
                        data={"car_id": car_id, "type": "eu_control"},
                    )
                    if success:
                        sent_count += 1
                    else:
                        error_count += 1

                notification_log_repository.record_sent(car_id, notification_type)

    return {
        "checked_users": len(user_tokens),
        "notifications_sent": sent_count,
        "notifications_skipped": skipped_count,
        "errors": error_count,
    }
