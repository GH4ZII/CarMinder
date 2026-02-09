"""Schemas for push notification token management."""
from pydantic import BaseModel


class PushTokenRegister(BaseModel):
    """Request body for registering a push token."""
    expo_push_token: str


class PushTokenResponse(BaseModel):
    """Response after registering a push token."""
    success: bool
    message: str
