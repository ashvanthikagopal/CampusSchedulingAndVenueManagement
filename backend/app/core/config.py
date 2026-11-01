"""
Application configuration and environment variables.
"""
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    PROJECT_NAME: str = "Zero Hour Campus Scheduler"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./cit_scheduler.db")

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

