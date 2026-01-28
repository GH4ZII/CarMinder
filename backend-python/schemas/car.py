from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CarBase(BaseModel):
    registreringsnummer: str
    merke: str
    modell: str
    arsmodell: str
    farge: str
    kilometer: int = 0
    forstegangregistrert: str
    chassisnummer: str
    drivstoff: str
    girkasse: str
    motoreffekt: int
    slagvolum: int
    co2utslipp: int
    forbruk: float
    egenvekt: int
    totalvekt: int
    antallseter: int
    antalldorer: int
    karosseri: str
    eukontrollfrist: str
    makshastighet: int

class CarCreate(CarBase):
    pass

class CarUpdate(BaseModel):
    kilometer: Optional[int] = None
    farge: Optional[str] = None
    eukontrollfrist: Optional[str] = None

class CarResponse(CarBase):
    id: str
    firebase_user_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class KilometerUpdate(BaseModel):
    kilometer: int

class VehicleLookupRequest(BaseModel):
    registration_number: str

class VehicleLookupResponse(BaseModel):
    success: bool
    car: Optional[CarBase] = None
    error: Optional[str] = None