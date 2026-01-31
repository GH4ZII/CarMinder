from fastapi import APIRouter, HTTPException, status

# Import schemas
from schemas.auth import (
    GoogleRequest,
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UserOut,
)
# Import services
from services.auth_firebase import (
    login_email_password,
    login_google,
    signup_email_password,
)
from services.jwt_auth import create_access_token


# Prefix for all auth routes
router = APIRouter(prefix="/auth", tags=["auth"])


# Function to login with email and password
@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    uid, email, display_name = login_email_password(req.email, req.password)
    token = create_access_token(uid, email, display_name)
    return TokenResponse(
        access_token=token,
        user=UserOut(uid=uid, email=email, displayName=display_name),
    )


# Function to sign up with email and password
@router.post("/signup", response_model=TokenResponse)
def signup(req: SignupRequest):
    uid, email, display_name = signup_email_password(
        req.email, req.password, (req.name or "").strip() or req.email
    )
    token = create_access_token(uid, email, display_name)
    return TokenResponse(
        access_token=token,
        user=UserOut(uid=uid, email=email, displayName=display_name),
    )


# Function to sign in with Google
@router.post("/google", response_model=TokenResponse)
def google(req: GoogleRequest):
    if not (req.id_token or req.id_token.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="id_token required",
        )
    uid, email, display_name = login_google(req.id_token.strip())
    token = create_access_token(uid, email, display_name)
    return TokenResponse(
        access_token=token,
        user=UserOut(uid=uid, email=email, displayName=display_name),
    )
