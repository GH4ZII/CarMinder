"""
Router for push token registration and notification checking.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from config.auth import get_current_user_uid
from config.responses import AUTH_RESPONSES, BAD_REQUEST_RESPONSE, FORBIDDEN_RESPONSE
from schemas.push_token import PushTokenRegister, PushTokenResponse
from services import push_token_service

router = APIRouter(tags=["notifications"])


@router.post(
    "/push-tokens",
    response_model=PushTokenResponse,
    responses={**AUTH_RESPONSES, **BAD_REQUEST_RESPONSE},
)
def register_push_token(
    body: PushTokenRegister,
    uid: str = Depends(get_current_user_uid),
):
    """Register an Expo push token for the authenticated user."""
    push_token_service.register_push_token(uid, body.expo_push_token)
    return PushTokenResponse(success=True, message="Push token registered")


@router.delete("/push-tokens", responses={**AUTH_RESPONSES, **BAD_REQUEST_RESPONSE})
def unregister_push_token(
    body: PushTokenRegister,
    uid: str = Depends(get_current_user_uid),
):
    """Remove a push token (e.g., on sign out)."""
    push_token_service.unregister_push_token(body.expo_push_token)
    return {"success": True, "message": "Push token removed"}


@router.post("/notifications/check-deadlines", responses=FORBIDDEN_RESPONSE)
async def check_deadlines(
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
):
    """
    Check EU control deadlines and send push notifications.

    Protected by a shared secret header so only the cron scheduler can call it.
    """
    try:
        result = await push_token_service.check_deadlines(x_cron_secret)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Invalid cron secret")
    return result
