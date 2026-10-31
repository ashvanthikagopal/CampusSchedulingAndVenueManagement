"""
Authentication endpoints: login, me, and demo directory.
"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.database.session import get_db
from backend.app.models.entities import User
from backend.app.schemas.schemas import (
    LoginRequest, TokenResponse, UserResponse, DirectoryResponse,
    DirectoryAdmin, DirectoryCoordinator, DirectoryFaculty, DirectoryClub
)
from backend.app.core.security import verify_password, create_access_token
from backend.app.core.config import settings
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates user by identifier (case-insensitive email OR faculty ID like 'F06')
    and password. Backward compatible with {email, password}.
    Returns JWT and full user profile with generic error message to prevent enumeration.
    """
    raw_ident = (creds.identifier or creds.email or "").strip()
    if not raw_ident:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect identifier or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Search by email OR faculty_id (case-insensitive)
    user = db.query(User).filter(
        or_(
            User.email.ilike(raw_ident),
            User.faculty_id.ilike(raw_ident)
        )
    ).first()

    if not user or not verify_password(creds.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect identifier or password",
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
def get_directory(db: Session = Depends(get_db)):
    """
    Returns grouped, password-free lists of all demo accounts.
    Gated behind DEMO_MODE=true environment variable.
    """
    if not settings.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account directory is disabled in production mode."
        )

    all_users = db.query(User).all()

    admins: List[DirectoryAdmin] = []
    coordinators: List[DirectoryCoordinator] = []
    faculty: List[DirectoryFaculty] = []
    clubs: List[DirectoryClub] = []

    for u in all_users:
        if u.role == "admin":
            admins.append(DirectoryAdmin(name=u.name, email=u.email))
        elif u.role == "department_coordinator":
            coordinators.append(DirectoryCoordinator(name=u.name, department=u.department, email=u.email))
        elif u.role == "faculty":
            faculty.append(DirectoryFaculty(
                name=u.name, department=u.department, faculty_id=u.faculty_id, email=u.email
            ))
        elif u.role == "club":
            clubs.append(DirectoryClub(club_name=u.club_name or u.name, email=u.email))

    # Sort predictably
    admins.sort(key=lambda x: x.email)
    coordinators.sort(key=lambda x: (x.department or "", x.email))
    faculty.sort(key=lambda x: x.faculty_id or x.name)
    clubs.sort(key=lambda x: x.club_name)

    return DirectoryResponse(
        admins=admins,
        coordinators=coordinators,
        faculty=faculty,
        clubs=clubs,
        role_passwords_hint=False
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
