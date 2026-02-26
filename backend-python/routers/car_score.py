"""
Car care score router — provides computed care scores for vehicles.
"""
from fastapi import APIRouter, Depends, HTTPException

from config.auth import get_current_user_uid
from exceptions import NotFoundError
from schemas.car_score import CarCareScoreResponse
from services import scoring_service

router = APIRouter(tags=["car-score"])


@router.get("/cars/{car_id}/score", response_model=CarCareScoreResponse)
def get_car_care_score(car_id: str, uid: str = Depends(get_current_user_uid)):
    """
    Compute and return the car care score for a specific car.

    Evaluates maintenance regularity, EU inspection compliance,
    incident history, mileage tracking, and documentation quality
    to produce a 0-100 score with an A-F grade.
    """
    try:
        return scoring_service.compute_car_care_score(uid, car_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
