"""
Service interval schemas for tracking when maintenance is due.
"""
from datetime import date
from typing import Optional

from pydantic import BaseModel


# Default intervals for each service type
# km = mileage interval, months = time interval
DEFAULT_INTERVALS: dict[str, dict[str, Optional[int]]] = {
    "oil_change": {"km": 15000, "months": 12},
    "brake_service": {"km": 30000, "months": 24},
    "tire_change": {"km": 40000, "months": 48},
    "inspection": {"km": None, "months": 12},  # EU control - time only
    "repair": {"km": None, "months": None},  # No regular interval
    "other": {"km": None, "months": None},  # No regular interval
}


class ServiceDueStatus(BaseModel):
    """Computed status for a single service type."""

    event_type: str
    last_date: Optional[date] = None
    last_mileage: Optional[int] = None
    due_date: Optional[date] = None
    due_mileage: Optional[int] = None
    is_overdue: bool = False
    days_until_due: Optional[int] = None
    km_until_due: Optional[int] = None
    urgency: str = "ok"  # "ok", "soon", "overdue", "unknown"


class CarServiceStatus(BaseModel):
    """Full service status for a single car."""

    car_id: str
    car_name: str  # e.g. "Toyota Corolla"
    registration: str
    current_mileage: int
    services: list[ServiceDueStatus]
    next_service: Optional[ServiceDueStatus] = None


class AllCarsServiceStatus(BaseModel):
    """Service status overview for all user's cars."""

    cars: list[CarServiceStatus]
    urgent_count: int  # Number of services that are overdue or due soon
    overdue_count: int
    soon_count: int
