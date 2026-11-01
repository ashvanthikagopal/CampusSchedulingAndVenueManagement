"""
Application configuration and environment variables.
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DEFAULT_DB_PATH = (REPO_ROOT / "cit_scheduler.db").as_posix()


def get_sample_disruption_path() -> Path:
    """Returns absolute path to sample_disruption.json with multi-location fallback."""
    candidates = [
        REPO_ROOT / "starter_pack" / "examples" / "sample_disruption.json",
        REPO_ROOT / "data" / "starter_dataset" / "examples" / "sample_disruption.json",
        Path("starter_pack/examples/sample_disruption.json"),
        Path("data/starter_dataset/examples/sample_disruption.json"),
    ]
    for c in candidates:
        if c.exists():
            return c.resolve()
    return (REPO_ROOT / "starter_pack" / "examples" / "sample_disruption.json")


def get_schedule_example_path() -> Path:
    """Returns absolute path to schedule.example.json with fallback."""
    candidates = [
        REPO_ROOT / "starter_pack" / "examples" / "schedule.example.json",
        REPO_ROOT / "data" / "starter_dataset" / "examples" / "schedule.example.json",
        REPO_ROOT / "exports" / "schedule.json",
    ]
    for c in candidates:
        if c.exists():
            return c.resolve()
    return (REPO_ROOT / "starter_pack" / "examples" / "schedule.example.json")


def get_starter_dataset_path() -> Path:
    """Returns absolute path to cit_public.json."""
    return (REPO_ROOT / "data" / "starter_dataset" / "cit_public.json").resolve()


def get_export_schedule_path() -> Path:
    """Returns absolute path to exports/schedule.json."""
    return (REPO_ROOT / "exports" / "schedule.json").resolve()


def get_export_schedule_after_path() -> Path:
    """Returns absolute path to exports/schedule_after.json."""
    return (REPO_ROOT / "exports" / "schedule_after.json").resolve()


class Settings(BaseSettings):
    PROJECT_NAME: str = "CIT Campus Scheduler"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

    # JWT Authentication
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-cit-scheduler-demo-jwt-key-32-chars")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

    # AI Configuration (Gemini API)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # Solver Defaults
    SOLVER_TIME_LIMIT_SECONDS: float = float(os.getenv("SOLVER_TIME_LIMIT_SECONDS", "60.0"))
    SOLVER_WORKERS: int = int(os.getenv("SOLVER_WORKERS", "8"))
    SOLVER_RANDOM_SEED: int = int(os.getenv("SOLVER_RANDOM_SEED", "42"))

    # Demo Simulation Settings
    DEMO_TODAY_DATE: str = os.getenv("DEMO_TODAY_DATE", "2027-01-25")
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes")

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "*"
    ]

    model_config = SettingsConfigDict(env_file=".env", extra="allow")


settings = Settings()
