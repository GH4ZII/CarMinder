"""
Router for push token registration and notification checking.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from config.auth import get_current_user_uid
from config.settings import get_settings
from repositories import push_token_repository
from schemas.push_token import PushTokenRegister, PushTokenResponse
from services import notification_service

router = APIRouter(tags=["notifications"])


@router.post("/push-tokens", response_model=PushTokenResponse)
def register_push_token(
    body: PushTokenRegister,
    uid: str = Depends(get_current_user_uid),
):
    """Register an Expo push token for the authenticated user."""
    push_token_repository.upsert_push_token(uid, body.expo_push_token)
    return PushTokenResponse(success=True, message="Push token registered")


@router.delete("/push-tokens")
def unregister_push_token(
    body: PushTokenRegister,
    uid: str = Depends(get_current_user_uid),
):
    """Remove a push token (e.g., on sign out)."""
    push_token_repository.delete_push_token(body.expo_push_token)
    return {"success": True, "message": "Push token removed"}


@router.post("/notifications/check-deadlines")
async def check_deadlines(
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
):
    """
    Check EU control deadlines and send push notifications.

    Protected by a shared secret header so only the cron scheduler can call it.
    """
    settings = get_settings()
    expected_secret = settings.get("CRON_SECRET")

    if expected_secret and x_cron_secret != expected_secret:
        raise HTTPException(status_code=403, detail="Invalid cron secret")

    result = await notification_service.check_and_send_eu_control_reminders()
    return result
