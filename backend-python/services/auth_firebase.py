import os
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException, status

load_dotenv()

API_KEY = os.getenv("FIREBASE_WEB_API_KEY")
# Base URL for Firebase Auth API
BASE = "https://identitytoolkit.googleapis.com/v1/accounts"

if not API_KEY:
    raise ValueError("FIREBASE_WEB_API_KEY must be set in backend .env")


# Function to make a request to the Firebase Auth API
def _firebase_req(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{BASE}{path}?key={API_KEY}"
    r = httpx.post(url, json=payload, timeout=15.0)
    data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    if not r.is_success:
        msg = (data.get("error") or {}).get("message", "Firebase auth failed")
        if "EMAIL_NOT_FOUND" in msg or "INVALID_LOGIN_CREDENTIALS" in msg:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="EMAIL_NOT_FOUND")
        if "INVALID_PASSWORD" in msg:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="INVALID_PASSWORD")
        if "EMAIL_EXISTS" in msg:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="EMAIL_EXISTS")
        if "INVALID_IDP_RESPONSE" in msg or "INVALID_CREDENTIAL" in msg:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="INVALID_IDP_RESPONSE")
        if "WEAK_PASSWORD" in msg or "weak" in msg.lower():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="WEAK_PASSWORD")
        if "OPERATION_NOT_ALLOWED" in msg:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OPERATION_NOT_ALLOWED")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    return data


# Function to login with email and password
def login_email_password(email: str, password: str) -> tuple[str, str, str | None]:
    data = _firebase_req(
        ":signInWithPassword",
        {"email": email, "password": password, "returnSecureToken": True},
    )
    uid = data.get("localId") or data.get("userId") or ""
    em = data.get("email") or email
    name = data.get("displayName") or None
    return uid, em, name


# Function to sign up with email and password
def signup_email_password(email: str, password: str, display_name: str) -> tuple[str, str, str]:
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
            {"idToken": token, "displayName": display_name, "returnSecureToken": True},
        )
        name = up.get("displayName") or display_name
    else:
        name = display_name
    return uid, em, name


# Function to login with Google
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
