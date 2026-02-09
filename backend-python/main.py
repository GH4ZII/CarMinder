from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.settings import get_settings
from routers import auth, car, maintenance_event, service_interval

app = FastAPI(title="CarMinder API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(car.router)
app.include_router(maintenance_event.router)
app.include_router(maintenance_event.router_meta)
app.include_router(service_interval.router)


@app.get("/")
def read_root():
    return {"message": "CarMinder API is running"}


@app.get("/health")
def health_check():
    settings = get_settings()
    return {
        "api": "running",
        "environment_variables": {
            "SUPABASE_URL": bool(settings["SUPABASE_URL"]),
            "SUPABASE_SERVICE_KEY": bool(settings["SUPABASE_SERVICE_KEY"]),
            "JWT_SECRET_KEY": bool(settings["JWT_SECRET_KEY"]),
        },
    }
