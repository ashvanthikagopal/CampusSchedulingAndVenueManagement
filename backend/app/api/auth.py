"""
Authentication endpoints: login, directory, and current user info.
Supports identifier-based login (email or faculty ID) and dataset-driven directory.
"""
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database.session import get_db
from backend.app.models.entities import User
from backend.app.schemas.schemas import LoginRequest, TokenResponse, UserResponse
from backend.app.core.security import verify_password, create_access_token
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    """
    Rule-based login: accepts 'identifier' (email OR faculty ID like 'F06', case-insensitive) + password.
    Maintains backward compatibility with 'email'.
    Generic error message with zero user enumeration.
    """
    ident = (creds.identifier or creds.email or "").strip()
    if not ident:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/ID or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    ident_lower = ident.lower()
    ident_upper = ident.upper()

    user = db.query(User).filter(
        (User.email == ident_lower) |
        (User.faculty_id == ident_upper)
    ).first()

    # Legacy demo alias support for backwards compatibility
    if not user:
        if ident_lower in ("club@cit.edu", "club_dance@cit.edu"):
            user = db.query(User).filter(User.email == "club_dance@cit.edu").first()
        elif ident_lower in ("student@cit.edu", "student_y1a@cit.edu"):
            user = db.query(User).filter(User.email == "student_y1a@cit.edu").first()

    if not user or not verify_password(creds.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/ID or password",
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
            "student_group": getattr(user, "student_group", None),
        }
    }


@router.get("/directory")
def get_auth_directory(db: Session = Depends(get_db)):
    """
    Returns grouped, password-free lists for demo navigation.
    Active ONLY when DEMO_MODE=true in environment.
    Passwords are NOT returned by this API.
    """
    if not settings.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Directory endpoint is disabled in production mode"
        )

    users = db.query(User).all()
    if not users or len(users) < 62:
        from backend.app.core.seed_users import seed_users
        users = seed_users(db)

    admins = [
        {"name": u.name, "email": u.email}
        for u in users if u.role == "admin"
    ]
    admins.sort(key=lambda x: x["name"])

    coordinators = [
        {"name": u.name, "department": u.department, "email": u.email}
        for u in users if u.role == "department_coordinator"
    ]
    coordinators.sort(key=lambda x: x["name"])

    faculty = [
        {"name": u.name, "department": u.department, "faculty_id": u.faculty_id, "email": u.email}
        for u in users if u.role == "faculty"
    ]
    faculty.sort(key=lambda x: int(x["faculty_id"][1:]) if x.get("faculty_id") and x["faculty_id"][1:].isdigit() else 999)

    clubs = [
        {"club_name": u.club_name or u.name, "email": u.email}
        for u in users if u.role == "club"
    ]
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
