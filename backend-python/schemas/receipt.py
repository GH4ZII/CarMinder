"""
Pydantic schemas for the receipt scanning endpoint.
"""

from typing import Optional

from pydantic import BaseModel


class ExtractedReceiptData(BaseModel):
    """The structured data extracted from a receipt image by Claude Vision."""

    event_type: str
    event_date: Optional[str] = None  # YYYY-MM-DD or null
    mileage: Optional[int] = None
    cost: Optional[float] = None
    vendor: Optional[str] = None
    notes: Optional[str] = None


class ScanReceiptResponse(BaseModel):
    """Full response returned by POST /cars/{car_id}/events/scan-receipt."""

    receipt_image_url: str
    extracted: ExtractedReceiptData
