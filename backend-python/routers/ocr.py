import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from config.auth import get_current_user_uid
from exceptions import ValidationError
from schemas.ocr import ReceiptOcrResponse
from services import ocr_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["ocr"])


@router.post("/receipt", response_model=ReceiptOcrResponse)
async def scan_receipt(image: UploadFile = File(...), uid: str = Depends(get_current_user_uid)):
    _ = uid
    try:
        return await ocr_service.extract_receipt_data(image)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        logger.exception("Unexpected OCR error")
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")
