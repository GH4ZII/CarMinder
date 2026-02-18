from typing import Any

import httpx

from config.settings import get_settings
from exceptions import AuthenticationError, ValidationError

BASE = "https://identitytoolkit.googleapis.com/v1/accounts"


def _get_api_key() -> str:
    key = get_settings()["FIREBASE_WEB_API_KEY"]
    if not key:
        raise ValueError("FIREBASE_WEB_API_KEY must be set in backend .env")
    return key


def _firebase_req(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{BASE}{path}?key={_get_api_key()}"
    r = httpx.post(url, json=payload, timeout=15.0)
    data = (
        r.json()
        if r.headers.get("content-type", "").startswith("application/json")
        else {}
    )
    if not r.is_success:
        msg = (data.get("error") or {}).get("message", "Firebase auth failed")
        if "EMAIL_NOT_FOUND" in msg or "INVALID_LOGIN_CREDENTIALS" in msg:
            raise AuthenticationError("EMAIL_NOT_FOUND")
        if "INVALID_PASSWORD" in msg:
            raise AuthenticationError("INVALID_PASSWORD")
        if "EMAIL_EXISTS" in msg:
            raise ValidationError("EMAIL_EXISTS")
        if "INVALID_IDP_RESPONSE" in msg or "INVALID_CREDENTIAL" in msg:
            raise AuthenticationError("INVALID_IDP_RESPONSE")
        if "WEAK_PASSWORD" in msg or "weak" in msg.lower():
            raise ValidationError("WEAK_PASSWORD")
        if "OPERATION_NOT_ALLOWED" in msg:
            raise ValidationError("OPERATION_NOT_ALLOWED")
        raise ValidationError(msg)
    return data


def login_email_password(email: str, password: str) -> tuple[str, str, str | None]:
    data = _firebase_req(
        ":signInWithPassword",
        {"email": email, "password": password, "returnSecureToken": True},
    )
    uid = data.get("localId") or data.get("userId") or ""
    em = data.get("email") or email
    name = data.get("displayName") or None
    return uid, em, name


def signup_email_password(
    email: str, password: str, display_name: str
) -> tuple[str, str, str]:
    data = _firebase_req(
        ":signUp",
        {"email": email, "password": password, "returnSecureToken": True},
    )
    uid = data.get("localId") or data.get("userId") or ""
    em = data.get("email") or email
    token = data.get("idToken")
    if token and display_name:
        up = _firebase_req(
            ":update",
            {
                "idToken": token,
                "displayName": display_name,
                "returnSecureToken": True,
            },
        )
        name = up.get("displayName") or display_name
    else:
        name = display_name
    return uid, em, name


def login_google(id_token: str) -> tuple[str, str | None, str | None]:
    post = f"id_token={id_token}&providerId=google.com"
    data = _firebase_req(
        ":signInWithIdp",
        {
            "postBody": post,
            "requestUri": "http://localhost",
            "returnSecureToken": True,
        },
    )
    uid = data.get("localId") or data.get("userId") or ""
    em = data.get("email")
    name = data.get("displayName") or data.get("fullName")
    return uid, em, name


def login_apple(
    id_token: str,
) -> tuple[str, str | None, str | None]:
    post = f"id_token={id_token}&providerId=apple.com"
    data = _firebase_req(
        ":signInWithIdp",
        {
            "postBody": post,
            "requestUri": "http://localhost",
            "returnSecureToken": True,
        },
    )
    uid = data.get("localId") or data.get("userId") or ""
    em = data.get("email")
    name = data.get("displayName") or data.get("fullName")
    return uid, em, name


def send_password_reset_email(email: str) -> None:
    """Trigger Firebase password reset email for given address.

    Uses PASSWORD_RESET OOB code flow; Firebase handles the email contents
    and reset UI based on project configuration.
    """
    _firebase_req(
        ":sendOobCode",
        {
            "requestType": "PASSWORD_RESET",
            "email": email,
        },
    )
