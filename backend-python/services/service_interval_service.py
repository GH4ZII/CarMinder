"""
Service interval calculation logic.

This is the core domain logic that computes when each service is due
based on maintenance history. The client receives pre-computed values.
"""
from datetime import date, timedelta
from typing import Any, Optional

from exceptions import NotFoundError
from repositories import car_repository, maintenance_repository
from schemas.service_interval import (
    DEFAULT_INTERVALS,
    AllCarsServiceStatus,
    CarServiceStatus,
    ServiceDueStatus,
)


def _calculate_due_status(
    event_type: str,
    last_event: Optional[dict[str, Any]],
    current_mileage: int,
    interval_km: Optional[int],
    interval_months: Optional[int],
) -> ServiceDueStatus:
    """
    Core domain logic: compute when a service is due.
    
    This considers both time-based and mileage-based intervals,
    and returns whichever comes first.
    """
    today = date.today()
    status = ServiceDueStatus(event_type=event_type)

    # If no intervals defined, this service type has no regular schedule
    if interval_km is None and interval_months is None:
        status.urgency = "ok"
        if last_event:
            status.last_date = date.fromisoformat(last_event["event_date"])
            status.last_mileage = last_event.get("mileage")
        return status

    # Extract last service info
    if last_event:
        status.last_date = date.fromisoformat(last_event["event_date"])
        status.last_mileage = last_event.get("mileage")

    # Calculate due date based on time interval
    if interval_months and status.last_date:
        status.due_date = status.last_date + timedelta(days=interval_months * 30)
        status.days_until_due = (status.due_date - today).days

    # Calculate due mileage based on km interval
    if interval_km and status.last_mileage is not None:
        status.due_mileage = status.last_mileage + interval_km
        status.km_until_due = status.due_mileage - current_mileage

    # Determine urgency based on both criteria
    is_date_overdue = status.days_until_due is not None and status.days_until_due < 0
    is_km_overdue = status.km_until_due is not None and status.km_until_due < 0
    is_date_soon = status.days_until_due is not None and 0 <= status.days_until_due <= 30
    is_km_soon = status.km_until_due is not None and 0 <= status.km_until_due <= 1000

    if is_date_overdue or is_km_overdue:
        status.is_overdue = True
        status.urgency = "overdue"
    elif is_date_soon or is_km_soon:
        status.urgency = "soon"
    elif status.last_date is None and status.last_mileage is None:
        # Never done this service - mark as unknown
        status.urgency = "unknown"
    else:
        status.urgency = "ok"

    return status


def get_car_service_status(uid: str, car_id: str) -> CarServiceStatus:
    """Get full service status for a single car."""
    # Verify ownership
    car = car_repository.get_car_by_id_and_user(car_id, uid)
    if not car:
        raise NotFoundError("Car not found")

    current_mileage = car.get("kilometer", 0) or 0
    car_name = f"{car.get('merke', '')} {car.get('modell', '')}".strip() or "Unknown"
    registration = car.get("registreringsnummer", "")

    # Get all maintenance events for this car
    events = maintenance_repository.list_events_for_car(car_id)

    # Group events by type and find the most recent of each type
    latest_by_type: dict[str, dict[str, Any]] = {}
    for event in events:
        event_type = event["event_type"]
        if event_type not in latest_by_type:
            latest_by_type[event_type] = event
        else:
            existing_date = latest_by_type[event_type]["event_date"]
            if event["event_date"] > existing_date:
                latest_by_type[event_type] = event

    # Calculate status for each trackable service type
    services: list[ServiceDueStatus] = []
    trackable_types = ["oil_change", "brake_service", "tire_change", "inspection"]
    
    for event_type in trackable_types:
        intervals = DEFAULT_INTERVALS.get(event_type, {})
        last_event = latest_by_type.get(event_type)
        status = _calculate_due_status(
            event_type=event_type,
            last_event=last_event,
            current_mileage=current_mileage,
            interval_km=intervals.get("km"),
            interval_months=intervals.get("months"),
        )
        services.append(status)

    # Sort by urgency (overdue first, then soon, then unknown, then ok)
    urgency_order = {"overdue": 0, "soon": 1, "unknown": 2, "ok": 3}
    services.sort(
        key=lambda s: (
            urgency_order.get(s.urgency, 4),
            s.days_until_due if s.days_until_due is not None else 9999,
        )
    )

    # Find next urgent service (if any)
    next_service = None
    for s in services:
        if s.urgency in ("overdue", "soon"):
            next_service = s
            break

    return CarServiceStatus(
        car_id=car_id,
        car_name=car_name,
        registration=registration,
        current_mileage=current_mileage,
        services=services,
        next_service=next_service,
    )


def get_all_cars_service_status(uid: str) -> AllCarsServiceStatus:
    """Get service status overview for all of a user's cars."""
    cars = car_repository.get_cars_by_user(uid)

    car_statuses: list[CarServiceStatus] = []
    total_overdue = 0
    total_soon = 0

    for car in cars:
        car_id = car.get("id")
        if not car_id:
            continue

        try:
            status = get_car_service_status(uid, car_id)
            car_statuses.append(status)

            # Count urgent services
            for svc in status.services:
                if svc.urgency == "overdue":
                    total_overdue += 1
                elif svc.urgency == "soon":
                    total_soon += 1
        except NotFoundError:
            continue

    return AllCarsServiceStatus(
        cars=car_statuses,
        urgent_count=total_overdue + total_soon,
        overdue_count=total_overdue,
        soon_count=total_soon,
    )
