from datetime import UTC, datetime, timedelta

import jwt

from config.settings import get_settings
from exceptions import AuthenticationError

ALG = "HS256"
EXP_MINUTES = 60 * 24 * 7  # 7 days


def _get_secret() -> str:
    settings = get_settings()
    secret = settings["JWT_SECRET_KEY"]
    if not secret or len(secret) < 16:
        raise ValueError("JWT_SECRET_KEY must be set and at least 16 chars")
    return secret


def create_access_token(uid: str, email: str | None, display_name: str | None) -> str:
    now = datetime.now(UTC)
    exp = now + timedelta(minutes=EXP_MINUTES)
    payload = {
        "sub": uid,
        "email": email,
        "displayName": display_name,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, _get_secret(), algorithm=ALG)


def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, _get_secret(), algorithms=[ALG])
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token expired")
    except jwt.InvalidTokenError:
        raise AuthenticationError("Invalid token")
