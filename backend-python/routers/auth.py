from fastapi import APIRouter, HTTPException, status
import logging

from exceptions import AuthenticationError, ValidationError
from schemas.auth import (
    ForgotPasswordRequest,
    GoogleRequest,
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UserOut,
)
from services.auth_firebase import (
    login_email_password,
    login_google,
    send_password_reset_email,
    signup_email_password,
)
from services.jwt_auth import create_access_token

logger = logging.getLogger(__name__)

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


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(req: ForgotPasswordRequest):
    """Trigger password reset email via Firebase.

    Always returns 200 with a generic message to avoid leaking whether
    the email exists in the system.
    """
    logger.info("Forgot password requested for email=%s", req.email)
    try:
        send_password_reset_email(req.email)
        logger.info("Password reset email successfully triggered for %s", req.email)
    except (AuthenticationError, ValidationError) as e:
        # For security, do not reveal whether the email exists or not.
        # We still return success so the client shows a generic message.
        logger.warning(
            "Password reset failed for %s: %s (%s)", req.email, e, type(e).__name__
        )
        pass
    return {"detail": "If that email exists, a reset link has been sent"}
