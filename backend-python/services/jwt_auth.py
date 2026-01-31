import os
from datetime import UTC, datetime, timedelta

import jwt
from dotenv import load_dotenv
from fastapi import HTTPException, status

load_dotenv()

# Secret key for JWT
SECRET = os.getenv("JWT_SECRET") or os.getenv("JWT_SECRET_KEY")
# Algorithm for JWT
ALG = "HS256"
# Expiration time for JWT in minutes
EXP_MINUTES = 60 * 24 * 7  # 7 days

# Function to create a JWT access token
def create_access_token(uid: str, email: str | None, display_name: str | None) -> str:
    if not SECRET or len(SECRET) < 16:
        raise ValueError("JWT_SECRET must be set and at least 16 chars")
    now = datetime.now(UTC)
    exp = now + timedelta(minutes=EXP_MINUTES)
    payload = {
        "sub": uid,
        "email": email,
        "displayName": display_name,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, SECRET, algorithm=ALG)


# Function to verify a JWT access token
def verify_token(token: str) -> dict:
    if not SECRET:
        raise ValueError("JWT_SECRET must be set")
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALG])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
