from exceptions import NotFoundError
from repositories import car_repository, incident_repository, maintenance_repository
from schemas.public_history import (
    PublicCarHistory,
    PublicCarInfo,
    PublicIncidentReport,
    PublicMaintenanceEvent,
)


def get_public_history(registration_number: str) -> PublicCarHistory:
    reg = registration_number.strip().upper()
    car = car_repository.get_public_car_by_registration(reg)
    if not car:
        raise NotFoundError("Car not found or history is private")

    events = maintenance_repository.list_events_for_car(car["id"])
    incidents = incident_repository.list_incidents_for_car(car["id"])

    return PublicCarHistory(
        car=PublicCarInfo(
            registreringsnummer=car["registreringsnummer"],
            merke=car["merke"],
            modell=car["modell"],
            arsmodell=car["arsmodell"],
            farge=car["farge"],
            kilometer=car.get("kilometer", 0),
        ),
        maintenance_events=[
            PublicMaintenanceEvent(
                event_type=e["event_type"],
                event_date=e["event_date"],
                mileage=e.get("mileage"),
                vendor=e.get("vendor"),
            )
            for e in events
        ],
        incident_reports=[
            PublicIncidentReport(
                incident_date=i["incident_date"],
                severity=i["severity"],
                description=i["description"],
                damage_description=i.get("damage_description"),
                repair_status=i["repair_status"],
                mileage=i.get("mileage"),
            )
            for i in incidents
        ],
    )
