"""
Service interval router - provides computed maintenance due dates.
"""
from fastapi import APIRouter, Depends, HTTPException

from config.auth import get_current_user_uid
from exceptions import NotFoundError
from schemas.service_interval import AllCarsServiceStatus, CarServiceStatus
from services import service_interval_service

router = APIRouter(tags=["service-intervals"])


@router.get("/cars/{car_id}/service-status", response_model=CarServiceStatus)
def get_car_service_status(car_id: str, uid: str = Depends(get_current_user_uid)):
    """
    Get computed service intervals and due dates for a specific car.
    
    Returns status for each trackable service type (oil change, brakes, etc.)
    with urgency levels: 'overdue', 'soon', 'unknown', 'ok'.
    """
    try:
        return service_interval_service.get_car_service_status(uid, car_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.get("/service-status", response_model=AllCarsServiceStatus)
def get_all_service_status(uid: str = Depends(get_current_user_uid)):
    """
    Get service status overview for ALL of the user's cars.
    
    This is used on the home screen to show a summary of upcoming
    and overdue maintenance across all vehicles.
    """
    return service_interval_service.get_all_cars_service_status(uid)
