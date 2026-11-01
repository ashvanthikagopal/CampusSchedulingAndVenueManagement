
"""
SQLAlchemy database engine and session factory.
Supports SQLite locally and SSL-secured MySQL for deployment.
"""
import os
import ssl

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.app.core.config import settings

DATABASE_URL = settings.DATABASE_URL

connect_args = {}

if DATABASE_URL.startswith("sqlite"):
    connect_args = {
        "check_same_thread": False,
        "timeout": 30,
    }

elif DATABASE_URL.startswith("mysql"):
    ssl_ca = os.getenv("MYSQL_SSL_CA")

    if not ssl_ca or not os.path.isfile(ssl_ca):
        raise RuntimeError(
            "MYSQL_SSL_CA must point to the Aiven CA certificate."
        )

    ssl_context = ssl.create_default_context(cafile=ssl_ca)
    ssl_context.check_hostname = True
    ssl_context.verify_mode = ssl.CERT_REQUIRED

    connect_args = {
        "ssl": ssl_context,
    }

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=1800,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
