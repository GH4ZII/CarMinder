from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel


class PublicMaintenanceEvent(BaseModel):
    event_type: str
    event_date: date
    mileage: Optional[int] = None
    vendor: Optional[str] = None


class PublicIncidentReport(BaseModel):
    incident_date: date
    severity: str
    description: str
    damage_description: Optional[str] = None
    repair_status: str
    mileage: Optional[int] = None
    before_image_url: Optional[str] = None
    after_image_url: Optional[str] = None
    receipt_pdf_url: Optional[str] = None


class PublicCarInfo(BaseModel):
    registreringsnummer: str
    merke: str
    modell: str
    arsmodell: str
    farge: str
    kilometer: int


class PublicCarHistory(BaseModel):
    car: PublicCarInfo
    maintenance_events: List[PublicMaintenanceEvent]
    incident_reports: List[PublicIncidentReport]
