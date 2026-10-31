"""
Rule-based dynamic user seeding module for CIT Campus Scheduler.
Generates all 62 official user accounts directly from cit_public.json and accounts_config.json.
Idempotent and ultra-fast by pre-hashing role passwords once.
"""
import os
import re
import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.app.models.entities import User, BookingRequestModel
from backend.app.core.security import get_password_hash

CONFIG_PATH = Path(__file__).resolve().parent / "accounts_config.json"
DATASET_PATH = Path(__file__).resolve().parent.parent.parent.parent / "data" / "starter_dataset" / "cit_public.json"


def generate_club_slug(club_name: str) -> str:
    """Computes clean slug for club email: removes 'club' and 'society', keeps alphanumerics."""
    cleaned = re.sub(r'(?i)\b(club|society)\b', '', club_name)
    slug = re.sub(r'[^a-zA-Z0-9]', '', cleaned).lower()
    return slug


def seed_users(db: Session, dataset: Optional[Dict[str, Any]] = None) -> List[User]:
    """
    Seeds or updates all 62 accounts from the dataset and external config:
      - 2 Admins
      - 9 Coordinators (8 depts excluding ADMIN + T&P Cell)
      - 40 Faculty (F01 - F40)
      - 11 Clubs
    Fast idempotent upsert with password pre-hashing.
    """
    if dataset is None:
        with open(DATASET_PATH, "r", encoding="utf-8") as f:
            dataset = json.load(f)

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)

    role_passwords = config.get("role_passwords", {
        "admin": "Admin@123",
        "department_coordinator": "Coord@123",
        "faculty": "Faculty@123",
        "club": "Club@123",
        "student": "Student@123",
    })

    # Hash each role password exactly ONCE for instant execution
    hashed_passwords = {
        role: get_password_hash(pwd)
        for role, pwd in role_passwords.items()
    }

    accounts_to_seed = []

    # 1. Admins (from accounts_config.json)
    for adm in config.get("admins", []):
        accounts_to_seed.append({
            "id": f"usr_{adm['email'].split('@')[0]}",
            "name": adm["name"],
            "email": adm["email"].lower(),
            "password_hash": hashed_passwords["admin"],
            "role": "admin",
            "department": adm.get("department", "Administration"),
            "faculty_id": None,
            "club_name": None,
            "student_group": None,
        })

    # 2. Department Coordinators (from faculty departments excluding ADMIN + special coordinators)
    faculty_list = dataset.get("faculty", [])
    depts = sorted(list(set(
        f["department"] for f in faculty_list
        if f.get("department") and f["department"] != "ADMIN"
    )))
    for dept in depts:
        email = f"coord_{dept.lower()}@cit.edu"
        accounts_to_seed.append({
            "id": f"usr_coord_{dept.lower()}",
            "name": f"{dept} Department Coordinator",
            "email": email,
            "password_hash": hashed_passwords["department_coordinator"],
            "role": "department_coordinator",
            "department": dept,
            "faculty_id": None,
            "club_name": None,
            "student_group": None,
        })

    for sc in config.get("special_coordinators", []):
        accounts_to_seed.append({
            "id": f"usr_{sc['email'].split('@')[0]}",
            "name": sc["name"],
            "email": sc["email"].lower(),
            "password_hash": hashed_passwords["department_coordinator"],
            "role": "department_coordinator",
            "department": sc.get("department", "CSE"),
            "faculty_id": None,
            "club_name": None,
            "student_group": None,
        })

    # 3. Faculty Accounts (all faculty entries in dataset)
    for fac in faculty_list:
        fid = fac["id"]
        email = f"faculty_{fid.lower()}@cit.edu"
        accounts_to_seed.append({
            "id": f"usr_fac_{fid.lower()}",
            "name": fac["name"],
            "email": email,
            "password_hash": hashed_passwords["faculty"],
            "role": "faculty",
            "department": fac.get("department"),
            "faculty_id": fid,
            "club_name": None,
            "student_group": None,
        })

    # 4. Club Accounts (distinct requesters with role=='club' in booking_requests)
    reqs = dataset.get("booking_requests", [])
    seen_clubs = []
    for r in reqs:
        if r.get("role") == "club":
            c_name = r.get("requester")
            if c_name and c_name not in seen_clubs:
                seen_clubs.append(c_name)

    for club_name in seen_clubs:
        slug = generate_club_slug(club_name)
        email = f"club_{slug}@cit.edu"
        accounts_to_seed.append({
            "id": f"usr_club_{slug}",
            "name": club_name,
            "email": email,
            "password_hash": hashed_passwords["club"],
            "role": "club",
            "department": None,
            "faculty_id": None,
            "club_name": club_name,
            "student_group": None,
        })

    # Upsert all accounts into DB
    result_users = []
    for acc in accounts_to_seed:
        existing = db.query(User).filter(User.email == acc["email"]).first()
        if existing:
            existing.name = acc["name"]
            existing.password_hash = acc["password_hash"]
            existing.role = acc["role"]
            existing.department = acc["department"]
            existing.faculty_id = acc["faculty_id"]
            existing.club_name = acc["club_name"]
            existing.student_group = acc["student_group"]
            result_users.append(existing)
        else:
            new_user = User(**acc)
            db.add(new_user)
            result_users.append(new_user)

    db.commit()

    # Link submitted_by for initial booking requests in DB if existing
    for acc in accounts_to_seed:
        if acc["role"] == "club" and acc["club_name"]:
            db.query(BookingRequestModel).filter(
                BookingRequestModel.requester == acc["club_name"],
                BookingRequestModel.submitted_by == None
            ).update({"submitted_by": acc["id"]}, synchronize_session=False)

    db.commit()
    return result_users

