"""
FastAPI application entry point for CIT Campus Scheduler and Venue Management.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import json

from backend.app.core.config import settings
from backend.app.database.session import Base, engine, SessionLocal
from backend.app.models.entities import User
from backend.app.core.seed_users import seed_users
from backend.app.schemas.schemas import PublicStatsResponse

# Routers
from backend.app.api.auth import router as auth_router
from backend.app.api.dataset import router as dataset_router
from backend.app.api.schedule import router as schedule_router
from backend.app.api.exports import router as exports_router
from backend.app.api.exams import router as exams_router
from backend.app.api.bookings import router as bookings_router
from backend.app.api.disruptions import router as disruptions_router
from backend.app.api.ai import router as ai_router
from backend.app.api.admin import router as admin_router
from backend.app.api.notifications import router as notifications_router
from backend.app.api.session_requests import router as session_requests_router
from backend.app.api.rooms import router as rooms_router


def seed_demo_accounts_if_empty():
    db = SessionLocal()
    try:
        # Create all tables if not exist
        Base.metadata.create_all(bind=engine)
        seed_users(db)
    except Exception as e:
        print(f"Warning during seed: {e}")
    finally:
        db.close()


# Ensure tables and demo accounts are initialized on startup
seed_demo_accounts_if_empty()


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_demo_accounts_if_empty()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers under /api
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(dataset_router, prefix=settings.API_PREFIX)
app.include_router(schedule_router, prefix=settings.API_PREFIX)
app.include_router(exports_router, prefix=settings.API_PREFIX)
app.include_router(exams_router, prefix=settings.API_PREFIX)
app.include_router(bookings_router, prefix=settings.API_PREFIX)
app.include_router(disruptions_router, prefix=settings.API_PREFIX)
app.include_router(ai_router, prefix=settings.API_PREFIX)
app.include_router(admin_router, prefix=settings.API_PREFIX)
app.include_router(notifications_router, prefix=settings.API_PREFIX)
app.include_router(session_requests_router, prefix=settings.API_PREFIX)
app.include_router(rooms_router, prefix=settings.API_PREFIX)
app.include_router(rooms_router)  # Also allows direct /rooms/availability


def compute_public_stats() -> dict:
    from backend.validator.validator import run as official_validator_run

    try:
        with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        data = {"sessions": [], "rooms": [], "booking_requests": []}

    try:
        with open("exports/schedule.json", encoding="utf-8") as f:
            sched = json.load(f)
    except Exception:
        sched = {"sessions": [], "fest_week": {"bookings": [], "session_overrides": []}}

    try:
        val_rep = official_validator_run(data, sched)
        hard_violations = val_rep.get("hard_violation_count", 0)
        soft_total = val_rep.get("soft_total", 0)
        b_score = float(val_rep.get("bookings", {}).get("booking_score", 0.0))
        bookings_count = val_rep.get("bookings", {}).get("approved", 0) + val_rep.get("bookings", {}).get("alternatives", 0)
    except Exception:
        hard_violations = 0
        soft_total = 0
        b_score = 0.0
        bookings_count = len(sched.get("fest_week", {}).get("bookings", []))

    sessions_count = len(sched.get("sessions", []))
    moved_count = len(sched.get("fest_week", {}).get("session_overrides", []))

    return {
        "sessions_scheduled": sessions_count,
        "hard_violations": hard_violations,
        "booking_score": b_score,
        "bookings_count": bookings_count,
        "last_reschedule_moved_count": moved_count,
        "soft_penalty_total": soft_total
    }


@app.get("/api/public/stats", response_model=PublicStatsResponse)
@app.get("/public/stats", response_model=PublicStatsResponse)
def get_public_stats_endpoint():
    return compute_public_stats()


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "cit-scheduler-api",
        "version": settings.VERSION
    }
