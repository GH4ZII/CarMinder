from fastapi import APIRouter, HTTPException, status

from exceptions import AuthenticationError, ValidationError
from schemas.auth import (
    GoogleRequest,
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UserOut,
)
from services.auth_firebase import (
    login_email_password,
    login_google,
    signup_email_password,
)
from services.jwt_auth import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    try:
        uid, email, display_name = login_email_password(req.email, req.password)
    except AuthenticationError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=e.message)
    token = create_access_token(uid, email, display_name)
    return TokenResponse(
        access_token=token,
        user=UserOut(uid=uid, email=email, displayName=display_name),
    )


@router.post("/signup", response_model=TokenResponse)
def signup(req: SignupRequest):
    try:
        uid, email, display_name = signup_email_password(
            req.email, req.password, (req.name or "").strip() or req.email
        )
    except AuthenticationError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    token = create_access_token(uid, email, display_name)
    return TokenResponse(
        access_token=token,
        user=UserOut(uid=uid, email=email, displayName=display_name),
    )


@router.post("/google", response_model=TokenResponse)
def google(req: GoogleRequest):
    if not req.id_token or not req.id_token.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="id_token required",
        )
    try:
        uid, email, display_name = login_google(req.id_token.strip())
    except AuthenticationError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=e.message)
    token = create_access_token(uid, email, display_name)
    return TokenResponse(
        access_token=token,
        user=UserOut(uid=uid, email=email, displayName=display_name),
    )
