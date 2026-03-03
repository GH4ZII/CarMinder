"""
Ownership twin router.
"""
from fastapi import APIRouter, Depends, HTTPException

from config.auth import get_current_user_uid
from exceptions import NotFoundError, ValidationError
from schemas.car_twin import OwnershipTwinRequest, OwnershipTwinResponse
from services import car_twin_service

router = APIRouter(tags=["car-twin"])


@router.post("/cars/{car_id}/ownership-twin", response_model=OwnershipTwinResponse)
def simulate_ownership_twin(
    car_id: str,
    payload: OwnershipTwinRequest,
    uid: str = Depends(get_current_user_uid),
):
    """Run a what-if simulation for one car."""
    try:
        return car_twin_service.simulate_ownership_twin(uid, car_id, payload)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)
