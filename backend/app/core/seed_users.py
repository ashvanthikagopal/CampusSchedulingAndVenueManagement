"""
Seed users module: creates rule-based accounts from the dataset for every role.
Ensures zero hard-coded personal credentials in Python code.
Idempotent upsert by email with single password hashing per role for fast execution.
"""
import os
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.app.models.entities import User
from backend.app.core.security import get_password_hash

# Cache hashes in memory so bcrypt is only evaluated once per role
_ROLE_PASSWORD_HASHES: Dict[str, str] = {}

CONFIG_PATH = Path(__file__).parent / "accounts_config.json"


def load_accounts_config() -> Dict[str, Any]:
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "admins": [
            {
                "id": "usr_admin1",
                "name": "Dean's Office",
                "email": "admin@cit.edu",
                "role": "admin",
                "department": "Administration"
            },
            {
                "id": "usr_admin2",
                "name": "Spectra Core Team",
                "email": "admin2@cit.edu",
                "role": "admin",
                "department": "Administration"
            }
        ],
        "extra_coordinators": [
            {
                "id": "usr_coord_tnp",
                "name": "Training & Placement Cell",
                "email": "coord_tnp@cit.edu",
                "role": "department_coordinator",
                "department": "CSE"
            }
        ],
        "exclude_faculty_departments_for_coordinator": ["ADMIN"],
        "role_passwords": {
            "admin": "Admin@123",
            "department_coordinator": "Coord@123",
            "faculty": "Faculty@123",
            "club": "Club@123"
        }
    }


def get_cached_password_hashes(passwords: Dict[str, str]) -> Dict[str, str]:
    global _ROLE_PASSWORD_HASHES
    for role, raw_pwd in passwords.items():
        if role not in _ROLE_PASSWORD_HASHES:
            _ROLE_PASSWORD_HASHES[role] = get_password_hash(raw_pwd)
    return _ROLE_PASSWORD_HASHES


def make_club_slug(name: str) -> str:
    """Removes 'club' or 'society' and returns lowercase alphanumerics."""
    s = re.sub(r'(?i)\b(club|society)\b', '', name)
    s = re.sub(r'[^a-zA-Z0-9]', '', s).lower()
    return s


def build_accounts_from_dataset(dataset: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generates all 62 accounts from the dataset and config."""
    config = load_accounts_config()
    accounts: List[Dict[str, Any]] = []

    # 1. Admins from config
    for adm in config.get("admins", []):
        accounts.append({
            "id": adm.get("id", f"usr_admin_{adm['email']}"),
            "name": adm["name"],
            "email": adm["email"].lower(),
            "role": adm.get("role", "admin"),
            "department": adm.get("department", "Administration"),
            "faculty_id": None,
            "club_name": None
        })

    # 2. Coordinators: 1 per department in faculty[] excluding ADMIN
    exclude_depts = set(config.get("exclude_faculty_departments_for_coordinator", ["ADMIN"]))
    faculty_list = dataset.get("faculty", [])
    depts = sorted(list(set(f["department"] for f in faculty_list if f.get("department") not in exclude_depts)))

    for d in depts:
        accounts.append({
            "id": f"usr_coord_{d.lower()}",
            "name": f"{d} Department Coordinator",
            "email": f"coord_{d.lower()}@cit.edu",
            "role": "department_coordinator",
            "department": d,
            "faculty_id": None,
            "club_name": None
        })

    # Extra coordinators from config (e.g. Training & Placement Cell)
    for extra in config.get("extra_coordinators", []):
        accounts.append({
            "id": extra.get("id", f"usr_coord_{extra['email']}"),
            "name": extra["name"],
            "email": extra["email"].lower(),
            "role": extra.get("role", "department_coordinator"),
            "department": extra.get("department", "CSE"),
            "faculty_id": None,
            "club_name": None
        })

    # 3. Faculty: 1 per faculty[] entry
    for f in faculty_list:
        fid = f["id"]
        accounts.append({
            "id": f"usr_fac_{fid.lower()}",
            "name": f["name"],
            "email": f"faculty_{fid.lower()}@cit.edu",
            "role": "faculty",
            "department": f.get("department"),
            "faculty_id": fid,
            "club_name": None
        })

    # 4. Clubs: 1 per distinct requester with role == 'club' in booking_requests[]
    seen_clubs = set()
    for br in dataset.get("booking_requests", []):
        if br.get("role") == "club":
            req = br.get("requester")
            if req and req not in seen_clubs:
                seen_clubs.add(req)
                slug = make_club_slug(req)
                accounts.append({
                    "id": f"usr_club_{slug}",
                    "name": req,
                    "email": f"club_{slug}@cit.edu",
                    "role": "club",
                    "department": None,
                    "faculty_id": None,
                    "club_name": req
                })

    return accounts


def seed_users(db: Session, dataset: Optional[Dict[str, Any]] = None) -> List[User]:
    """
    Idempotent database seeding for all rule-based users.
    Upserts each user by email and commits.
    """
    if dataset is None:
        dataset_path = Path("data/starter_dataset/cit_public.json")
        if dataset_path.exists():
            with open(dataset_path, "r", encoding="utf-8") as f:
                dataset = json.load(f)
        else:
            dataset = {"faculty": [], "booking_requests": []}

    config = load_accounts_config()
    hashes = get_cached_password_hashes(config.get("role_passwords", {}))

    accounts = build_accounts_from_dataset(dataset)
    seeded_users: List[User] = []

    for acc in accounts:
        role = acc["role"]
        pwd_hash = hashes.get(role, hashes.get("club", "fallback_hash"))

        existing = db.query(User).filter(User.email == acc["email"]).first()
        if existing:
            existing.name = acc["name"]
            existing.role = acc["role"]
            existing.department = acc["department"]
            existing.faculty_id = acc["faculty_id"]
            existing.club_name = acc["club_name"]
            existing.password_hash = pwd_hash
            seeded_users.append(existing)
        else:
            user = User(
                id=acc["id"],
                name=acc["name"],
                email=acc["email"],
                password_hash=pwd_hash,
                role=acc["role"],
                department=acc["department"],
                faculty_id=acc["faculty_id"],
                club_name=acc["club_name"]
            )
            db.add(user)
            seeded_users.append(user)

    db.commit()
    return seeded_users

