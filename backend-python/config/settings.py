import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


@lru_cache()
def get_settings() -> dict[str, str | None]:
    return {
        "SUPABASE_URL": os.getenv("SUPABASE_URL"),
        "SUPABASE_SERVICE_KEY": os.getenv("SUPABASE_SERVICE_KEY"),
        "JWT_SECRET_KEY": os.getenv("JWT_SECRET_KEY"),
        "FIREBASE_WEB_API_KEY": os.getenv("FIREBASE_WEB_API_KEY"),
        "VEHICLE_API_KEY": os.getenv("VEHICLE_API_KEY"),
        "CRON_SECRET": os.getenv("CRON_SECRET"),
        "OCR_LANG": os.getenv("OCR_LANG"),
        "OCR_TESSERACT_CMD": os.getenv("OCR_TESSERACT_CMD"),
        "OCR_MAX_FILE_SIZE_BYTES": os.getenv("OCR_MAX_FILE_SIZE_BYTES"),
        "OCR_ALLOWED_MIME_TYPES": os.getenv("OCR_ALLOWED_MIME_TYPES"),
    }
