from typing import Union

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

# Load environment variables
load_dotenv()

# Debug: Print environment variables (without exposing secrets)
print("=" * 50)
print("🚀 CarMinder API Starting")
print("=" * 50)
print(f"✅ SUPABASE_URL present: {bool(os.getenv('SUPABASE_URL'))}")
print(f"✅ SUPABASE_SERVICE_KEY present: {bool(os.getenv('SUPABASE_SERVICE_KEY'))}")
print(f"✅ JWT_SECRET_KEY present: {bool(os.getenv('JWT_SECRET_KEY'))}")
print(f"✅ FIREBASE_WEB_API_KEY present: {bool(os.getenv('FIREBASE_WEB_API_KEY'))}")
print(f"✅ VEHICLE_API_KEY present: {bool(os.getenv('VEHICLE_API_KEY'))}")
print("=" * 50)

# Import routers
from routers import auth, car, maintenance_event

# Create FastAPI app
app = FastAPI(title="CarMinder API")

# Allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(car.router)
app.include_router(maintenance_event.router)


@app.get("/")
def read_root():
    return {"message": "CarMinder API is running"}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}

