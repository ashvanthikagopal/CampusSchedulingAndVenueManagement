"""
Authentication endpoints: login, directory, and current user info.
Supports identifier-based login (email or faculty ID) and dataset-driven directory.
"""
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database.session import get_db
from backend.app.models.entities import User
from backend.app.schemas.schemas import LoginRequest, TokenResponse, UserResponse
from backend.app.core.security import verify_password, create_access_token
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def resolve_user_by_identifier(ident: str, db: Session) -> Optional[User]:
    """
    Intelligent rule-based identifier resolver:
    - Email (e.g. faculty_f06@cit.edu, coord_cse@cit.edu, club_dance@cit.edu, admin@cit.edu)
    - Faculty ID (e.g. F06, f06, F01..F40)
    - Coordinator department code (e.g. CSE, ECE, EE, ME, CE, HSS, MA, PH, TNP)
    - Club slug or name (e.g. dance, Dance Club, robotics, coding)
    - Admin shorthand (admin, admin2, dean)
    - User ID (usr_fac_f06, usr_coord_cse, etc.)
    """
    ident_clean = ident.strip()
    if not ident_clean:
        return None
    ident_lower = ident_clean.lower()
    ident_upper = ident_clean.upper()

    # 1. Direct email or faculty_id match
    user = db.query(User).filter(
        (User.email == ident_lower) |
        (User.faculty_id == ident_upper)
    ).first()
    if user:
        return user

    # 2. Check User.id directly (e.g. usr_fac_f06, usr_coord_cse, usr_admin)
    user = db.query(User).filter(User.id == ident_lower).first()
    if user:
        return user

    # 3. Coordinator by department code or coord_<dept>
    dept_code = ident_upper
    if ident_lower.startswith("coord_"):
        dept_code = ident_lower.replace("coord_", "").upper()

    if dept_code in ("TNP", "T&P", "T_N_P", "PLACEMENT", "TRAINING"):
        user = db.query(User).filter(User.email == "coord_tnp@cit.edu").first()
        if user:
            return user
    else:
        user = db.query(User).filter(
            User.role == "department_coordinator",
            User.department == dept_code
        ).first()
        if user:
            return user

    # 4. Club by slug or club_name (case-insensitive)
    club_search = ident_lower
    if club_search.startswith("club_"):
        club_search = club_search.replace("club_", "")
    # Check if matches slug in email: club_<slug>@cit.edu
    user = db.query(User).filter(
        User.role == "club",
        User.email == f"club_{club_search}@cit.edu"
    ).first()
    if user:
        return user

    # Check against club_name
    all_clubs = db.query(User).filter(User.role == "club").all()
    for c in all_clubs:
        c_name = (c.club_name or c.name or "").lower()
        if club_search == c_name or club_search in c_name or c_name.replace("club", "").replace("society", "").strip() == club_search:
            return c

    # 5. Admin shortcuts
    if ident_lower in ("admin", "dean", "deans_office", "dean_office"):
        return db.query(User).filter(User.email == "admin@cit.edu").first()
    if ident_lower in ("admin2", "spectra", "spectra_core"):
        return db.query(User).filter(User.email == "admin2@cit.edu").first()

    # 6. Legacy aliases
    if ident_lower in ("club@cit.edu", "club_dance@cit.edu"):
        return db.query(User).filter(User.email == "club_dance@cit.edu").first()
    elif ident_lower in ("student@cit.edu", "student_y1a@cit.edu"):
        return db.query(User).filter(User.email == "student_y1a@cit.edu").first()

    return None


def check_user_password(user: User, password: str) -> bool:
    """
    Verifies either the stored hash password or the systematic rule-based credentials:
    - Faculty: Faculty@123 OR <FacultyID>@123 (e.g. F06@123) OR Faculty@<FacultyID>
    - Coordinators: Coord@123 OR Coord@<DEPT>123 (e.g. Coord@CSE123) OR <DEPT>@123
    - Clubs: Club@123 OR Club@<Slug>123 (e.g. Club@Dance123) OR <Slug>@123
    - Admin: Admin@123
    """
    if not password:
        return False
    # 1. Standard stored hash check (e.g. Faculty@123, Coord@123, etc.)
    if verify_password(password, user.password_hash):
        return True

    # 2. Rule-based alternative passwords
    valid_rule_passwords = set()
    role = user.role

    if role == "faculty":
        fid = user.faculty_id or ""
        valid_rule_passwords.add("Faculty@123")
        valid_rule_passwords.add(f"{fid}@123")
        valid_rule_passwords.add(f"{fid.lower()}@123")
        valid_rule_passwords.add(f"Faculty@{fid}")
        valid_rule_passwords.add(f"{fid}@CIT")
        valid_rule_passwords.add(f"{fid}@cit.edu")
        if user.department:
            valid_rule_passwords.add(f"{user.department}@123")

    elif role == "department_coordinator":
        dept = user.department or ""
        valid_rule_passwords.add("Coord@123")
        valid_rule_passwords.add(f"Coord@{dept}123")
        valid_rule_passwords.add(f"{dept}@123")
        valid_rule_passwords.add(f"Coord@{dept}")
        valid_rule_passwords.add(f"Coord@{dept.lower()}123")

    elif role == "club":
        slug = user.email.split("@")[0].replace("club_", "")
        valid_rule_passwords.add("Club@123")
        valid_rule_passwords.add(f"Club@{slug.capitalize()}123")
        valid_rule_passwords.add(f"{slug.capitalize()}@123")
        valid_rule_passwords.add(f"Club@{slug}123")
        valid_rule_passwords.add(f"{slug}@123")

    elif role == "admin":
        valid_rule_passwords.add("Admin@123")
        valid_rule_passwords.add("Admin@cit123")
        valid_rule_passwords.add("CIT@Admin123")

    return password in valid_rule_passwords


@router.post("/login", response_model=TokenResponse)
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    """
    Rule-based login: accepts 'identifier' (email, faculty ID, dept code, club slug, or name) + password.
    Supports both universal role passwords and member-specific rule passwords.
    Generic error message with zero user enumeration.
    """
    ident = (creds.identifier or creds.email or "").strip()
    if not ident:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/ID or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = resolve_user_by_identifier(ident, db)

    if not user or not check_user_password(user, creds.password):
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
