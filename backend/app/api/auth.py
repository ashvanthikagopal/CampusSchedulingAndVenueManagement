"""
Authentication endpoints: login, me, and directory.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.database.session import get_db
from backend.app.models.entities import User
from backend.app.schemas.schemas import LoginRequest, TokenResponse, UserResponse, DirectoryResponse
from backend.app.core.security import verify_password, create_access_token
from backend.app.core.config import settings
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    raw_ident = creds.identifier or creds.email
    if not raw_ident:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    clean_ident = raw_ident.strip()

    # Match by email or faculty_id case-insensitively without user enumeration
    user = db.query(User).filter(
        (func.lower(User.email) == clean_ident.lower()) |
        (func.lower(User.faculty_id) == clean_ident.lower())
    ).first()

    if not user or not verify_password(creds.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token({"sub": user.id, "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "department": user.department,
            "faculty_id": user.faculty_id,
            "club_name": user.club_name,
        }
    }


@router.get("/directory", response_model=DirectoryResponse)
def get_auth_directory(db: Session = Depends(get_db)):
    if not settings.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Directory not available when DEMO_MODE is disabled"
        )

    users = db.query(User).all()

    admins = []
    coordinators = []
    faculty = []
    clubs = []

    for u in users:
        if u.role == "admin":
            admins.append({"name": u.name, "email": u.email})
        elif u.role == "department_coordinator":
            coordinators.append({"name": u.name, "department": u.department, "email": u.email})
        elif u.role == "faculty":
            faculty.append({"name": u.name, "department": u.department, "faculty_id": u.faculty_id, "email": u.email})
        elif u.role == "club":
            clubs.append({"club_name": u.club_name or u.name, "email": u.email})

    admins.sort(key=lambda x: x["email"])
    coordinators.sort(key=lambda x: (x.get("department") or "", x["name"]))
    faculty.sort(key=lambda x: x.get("faculty_id") or x["name"])
    clubs.sort(key=lambda x: x["club_name"])

    return {
        "admins": admins,
        "coordinators": coordinators,
        "faculty": faculty,
        "clubs": clubs,
        "role_passwords_hint": False
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

