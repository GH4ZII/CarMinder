from typing import Annotated

from pydantic import BaseModel, EmailStr, Field


NonEmptyStr = Annotated[str, Field(min_length=1)]


class LoginRequest(BaseModel):
    email: EmailStr
    password: NonEmptyStr


class SignupRequest(BaseModel):
    email: EmailStr
    password: NonEmptyStr
    name: NonEmptyStr


class GoogleRequest(BaseModel):
    id_token: NonEmptyStr


class AppleRequest(BaseModel):
    identity_token: NonEmptyStr
    email: EmailStr | None = None
    full_name: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class UserOut(BaseModel):
    uid: str
    email: str | None
    displayName: str | None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
