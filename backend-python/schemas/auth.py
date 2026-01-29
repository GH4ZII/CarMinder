from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    email: str
    password: str
    name: str


class GoogleRequest(BaseModel):
    id_token: str


class UserOut(BaseModel):
    uid: str
    email: str | None
    displayName: str | None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
