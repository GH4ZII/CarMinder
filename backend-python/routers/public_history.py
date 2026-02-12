from fastapi import APIRouter, HTTPException

from exceptions import NotFoundError
from schemas.public_history import PublicCarHistory
from services import public_history_service

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/history/{registration_number}", response_model=PublicCarHistory)
def get_public_history(registration_number: str):
    try:
        return public_history_service.get_public_history(registration_number)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
