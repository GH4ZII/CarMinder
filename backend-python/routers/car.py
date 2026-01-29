from fastapi import APIRouter, HTTPException, Header, Depends
from typing import List
from schemas.car import (
    CarCreate, 
    CarResponse, 
    CarUpdate, 
    KilometerUpdate,
    VehicleLookupRequest,
    VehicleLookupResponse
)
from config.database import get_supabase
from services.CarService import lookup_vehicle

router = APIRouter(prefix="/cars", tags=["cars"])


# ============ Vehicle Lookup ============

@router.post("/lookup", response_model=VehicleLookupResponse)
async def lookup_vehicle_info(request: VehicleLookupRequest):
    """
    Lookup vehicle information by registration number from Norwegian Vehicle Registry
    """
    try:
        car = await lookup_vehicle(request.registration_number)
        if car:
            return VehicleLookupResponse(success=True, car=car)
        return VehicleLookupResponse(success=False, error="Vehicle not found")
    except Exception as e:
        return VehicleLookupResponse(success=False, error=str(e))


# ============ CRUD Operations ============

@router.post("/", response_model=CarResponse)
def create_car(car: CarCreate, firebase_user_id: str = Header(..., alias="firebase-user-id")):
    """
    Save a new car for a user
    """
    supabase = get_supabase()
    
    # Check if car already exists for this user
    existing = supabase.table("cars").select("id").eq(
        "firebase_user_id", firebase_user_id
    ).eq(
        "registreringsnummer", car.registreringsnummer
    ).execute()
    
    if existing.data:
        raise HTTPException(status_code=400, detail="Car already registered to this user")
    
    car_data = car.model_dump()
    car_data["firebase_user_id"] = firebase_user_id
    
    result = supabase.table("cars").insert(car_data).execute()
    
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create car")
    
    return result.data[0]


@router.get("/", response_model=List[CarResponse])
def get_user_cars(firebase_user_id: str = Header(..., alias="firebase-user-id")):
    """
    Get all cars for the authenticated user
    """
    supabase = get_supabase()
    
    result = supabase.table("cars").select("*").eq(
        "firebase_user_id", firebase_user_id
    ).order("created_at", desc=True).execute()
    
    return result.data


@router.get("/{car_id}", response_model=CarResponse)
def get_car_by_id(car_id: str, firebase_user_id: str = Header(..., alias="firebase-user-id")):
    """
    Get a specific car by ID
    """
    supabase = get_supabase()
    
    result = supabase.table("cars").select("*").eq("id", car_id).eq(
        "firebase_user_id", firebase_user_id
    ).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Car not found")
    
    return result.data


@router.patch("/{car_id}", response_model=CarResponse)
def update_car(
    car_id: str, 
    updates: CarUpdate, 
    firebase_user_id: str = Header(..., alias="firebase-user-id")
):
    """
    Update car details
    """
    supabase = get_supabase()
    
    # Verify ownership
    existing = supabase.table("cars").select("id").eq("id", car_id).eq(
        "firebase_user_id", firebase_user_id
    ).single().execute()
    
    if not existing.data:
        raise HTTPException(status_code=404, detail="Car not found")
    
    update_data = updates.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = supabase.table("cars").update(update_data).eq("id", car_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to update car")
    
    return result.data[0]


@router.patch("/{car_id}/kilometer", response_model=CarResponse)
def update_kilometer(
    car_id: str, 
    data: KilometerUpdate,
    firebase_user_id: str = Header(..., alias="firebase-user-id")
):
    """
    Update car kilometer reading
    """
    supabase = get_supabase()
    
    # Verify ownership
    existing = supabase.table("cars").select("id", "kilometer").eq("id", car_id).eq(
        "firebase_user_id", firebase_user_id
    ).single().execute()
    
    if not existing.data:
        raise HTTPException(status_code=404, detail="Car not found")
    
    # Ensure new kilometer is higher than old
    if data.kilometer < existing.data.get("kilometer", 0):
        raise HTTPException(status_code=400, detail="New kilometer must be higher than current")
    
    result = supabase.table("cars").update({
        "kilometer": data.kilometer
    }).eq("id", car_id).execute()
    
    return result.data[0]


@router.delete("/{car_id}")
def delete_car(car_id: str, firebase_user_id: str = Header(..., alias="firebase-user-id")):
    """
    Delete a car
    """
    supabase = get_supabase()
    
    # Verify ownership
    existing = supabase.table("cars").select("id").eq("id", car_id).eq(
        "firebase_user_id", firebase_user_id
    ).single().execute()
    
    if not existing.data:
        raise HTTPException(status_code=404, detail="Car not found")
    
    supabase.table("cars").delete().eq("id", car_id).execute()
    
    return {"message": "Car deleted successfully", "id": car_id}