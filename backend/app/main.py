"""
FastAPI application entry point for CIT Campus Scheduler and Venue Management.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.app.core.config import settings
from backend.app.database.session import Base, engine, SessionLocal
from backend.app.models.entities import User, PriorityConfigModel, DatasetModel
from backend.app.core.security import get_password_hash

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
from backend.app.api.rooms import router as rooms_router


def seed_demo_accounts_if_empty():
    db = SessionLocal()
    try:
        # Create all tables if not exist
        Base.metadata.create_all(bind=engine)

        if db.query(User).count() == 0:
            demo_users = [
                User(
                    id="usr_admin1",
                    name="Campus Administrator",
                    email="admin@cit.edu",
                    password_hash=get_password_hash("Admin@123"),
                    role="admin",
                    department="Administration"
                ),
                User(
                    id="usr_admin2",
                    name="Dean of Academics",
                    email="admin2@cit.edu",
                    password_hash=get_password_hash("Admin@123"),
                    role="admin",
                    department="Administration"
                ),
                User(
                    id="usr_coord_cse",
                    name="CSE Coordinator",
                    email="coord_cse@cit.edu",
                    password_hash=get_password_hash("Coord@123"),
                    role="department_coordinator",
                    department="CSE"
                ),
                User(
                    id="usr_fac_f06",
                    name="Prof. Sharma (F06)",
                    email="faculty_f06@cit.edu",
                    password_hash=get_password_hash("Faculty@123"),
                    role="faculty",
                    department="CSE",
                    faculty_id="F06"
                ),
                User(
                    id="usr_club",
                    name="Club Representative",
                    email="club@cit.edu",
                    password_hash=get_password_hash("Club@123"),
                    role="club",
                    club_name="Student Clubs"
                ),
            ]
            for u in demo_users:
                db.add(u)
            db.commit()
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
app.include_router(rooms_router, prefix=settings.API_PREFIX)
app.include_router(rooms_router)  # Also allows direct /rooms/availability


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "cit-scheduler-api",
        "version": settings.VERSION
    }
