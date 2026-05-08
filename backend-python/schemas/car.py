from typing import Annotated, Optional

from pydantic import BaseModel, Field
from datetime import datetime


NonEmptyStr = Annotated[str, Field(min_length=1)]

class CarBase(BaseModel):
    registreringsnummer: NonEmptyStr
    merke: NonEmptyStr
    modell: NonEmptyStr
    arsmodell: NonEmptyStr
    farge: NonEmptyStr
    kilometer: int = 0
    forstegangregistrert: NonEmptyStr
    chassisnummer: NonEmptyStr
    drivstoff: NonEmptyStr
    girkasse: NonEmptyStr
    motoreffekt: int
    slagvolum: int
    co2utslipp: int
    forbruk: float
    egenvekt: int
    totalvekt: int
    antallseter: int
    antalldorer: int
    karosseri: NonEmptyStr
    eukontrollfrist: NonEmptyStr
    makshastighet: int
    public_history: bool = False

class CarCreate(CarBase):
    pass

class CarUpdate(BaseModel):
    kilometer: Optional[int] = None
    farge: Optional[str] = None
    eukontrollfrist: Optional[str] = None
    public_history: Optional[bool] = None

class CarResponse(CarBase):
    id: str
    firebase_user_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    retired_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class KilometerUpdate(BaseModel):
    kilometer: int

class VehicleLookupRequest(BaseModel):
    registration_number: NonEmptyStr

class VehicleLookupResponse(BaseModel):
    success: bool
    car: Optional[CarBase] = None
    error: Optional[str] = None


class TransferResponse(BaseModel):
    transfer_code: str
    expires_at: str


class ClaimRequest(BaseModel):
    transfer_code: NonEmptyStr
