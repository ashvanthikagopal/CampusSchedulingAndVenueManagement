"""
Rule-based user generation and seeding from dataset.
Builds accounts for every faculty member, department coordinator, club, and admin.
Idempotent upsert by email with cached role password hashes.
"""
from typing import Dict, Any, List, Optional
from pathlib import Path
import json
import re
from sqlalchemy.orm import Session

from backend.app.models.entities import User
from backend.app.core.security import get_password_hash


CONFIG_PATH = Path(__file__).resolve().parent / "accounts_config.json"


def load_accounts_config() -> Dict[str, Any]:
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "admins": [
            {"id": "usr_admin1", "email": "admin@cit.edu", "name": "Dean's Office", "role": "admin", "department": "Administration"},
            {"id": "usr_admin2", "email": "admin2@cit.edu", "name": "Spectra Core Team", "role": "admin", "department": "Administration"}
        ],
        "extra_coordinators": [
            {"id": "usr_coord_tnp", "email": "coord_tnp@cit.edu", "name": "Training & Placement Cell", "role": "department_coordinator", "department": "CSE"}
        ],
        "role_passwords": {
            "admin": "Admin@123",
            "department_coordinator": "Coord@123",
            "faculty": "Faculty@123",
            "club": "Club@123"
        }
    }


def make_club_slug(name: str) -> str:
    cleaned = name.lower().replace("club", "").replace("society", "")
    slug = re.sub(r"[^a-z0-9]", "", cleaned)
    return slug.strip()


def get_requester_user_id(requester: str, role: str) -> Optional[str]:
    """Resolves a booking requester name and role to the seeded user ID."""
    if not requester:
        return None
    r_lower = requester.lower()
    if role == "club":
        slug = make_club_slug(requester)
        return f"usr_club_{slug}"
    if "spectra" in r_lower:
        return "usr_admin2"
    if "dean" in r_lower:
        return "usr_admin1"
    if "placement" in r_lower or "tnp" in r_lower or "training" in r_lower:
        return "usr_coord_tnp"
    if "ece" in r_lower:
        return "usr_coord_ece"
    if "civil" in r_lower:
        return "usr_coord_ce"
    if "cse" in r_lower:
        return "usr_coord_cse"
    if "ee" in r_lower or "electrical" in r_lower:
        return "usr_coord_ee"
    if "me" in r_lower or "mech" in r_lower:
        return "usr_coord_me"
    m = re.search(r"\(f(\d+)\)", r_lower)
    if m:
        return f"usr_fac_f{m.group(1).zfill(2)}"
    return None


def build_accounts_list(dataset: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generates the full specification of all 62 accounts from dataset and config."""
    config = load_accounts_config()
    accounts: List[Dict[str, Any]] = []

    # 1. Admins
    for a in config.get("admins", []):
        accounts.append({
            "id": a.get("id", f"usr_{a['email'].split('@')[0]}"),
            "email": a["email"].lower(),
            "name": a["name"],
            "role": "admin",
            "department": a.get("department", "Administration"),
            "faculty_id": None,
            "club_name": None
        })

    # 2. Department Coordinators (1 per department in faculty[] excluding ADMIN)
    fac_list = dataset.get("faculty", [])
    depts = sorted(set(f.get("department") for f in fac_list if f.get("department") and f.get("department") != "ADMIN"))
    for dept in depts:
        dept_lower = dept.lower()
        accounts.append({
            "id": f"usr_coord_{dept_lower}",
            "email": f"coord_{dept_lower}@cit.edu",
            "name": f"{dept} Department Coordinator",
            "role": "department_coordinator",
            "department": dept,
            "faculty_id": None,
            "club_name": None
        })

    # Extra coordinators from config (e.g. Training & Placement Cell)
    for c in config.get("extra_coordinators", []):
        accounts.append({
            "id": c.get("id", f"usr_{c['email'].split('@')[0]}"),
            "email": c["email"].lower(),
            "name": c["name"],
            "role": "department_coordinator",
            "department": c.get("department", "CSE"),
            "faculty_id": None,
            "club_name": None
        })

    # 3. Faculty members (1 per entry in faculty[])
    for f in fac_list:
        fid = f.get("id", "")
        fid_lower = fid.lower()
        accounts.append({
            "id": f"usr_fac_{fid_lower}",
            "email": f"faculty_{fid_lower}@cit.edu",
            "name": f.get("name", f"Faculty {fid}"),
            "role": "faculty",
            "department": f.get("department"),
            "faculty_id": fid,
            "club_name": None
        })

    # 4. Clubs (1 per distinct requester with role == 'club' in booking_requests[])
    booking_requests = dataset.get("booking_requests", [])
    club_names = sorted(set(
        br.get("requester") for br in booking_requests
        if br.get("role") == "club" and br.get("requester")
    ))
    for club_name in club_names:
        slug = make_club_slug(club_name)
        accounts.append({
            "id": f"usr_club_{slug}",
            "email": f"club_{slug}@cit.edu",
            "name": club_name,
            "role": "club",
            "department": None,
            "faculty_id": None,
            "club_name": club_name
        })

    return accounts


def seed_users(db: Session, dataset: Optional[Dict[str, Any]] = None) -> List[User]:
    """
    Idempotently seeds all accounts derived from dataset.
    Hashes each role password once and reuses the hash.
    Upserts by email.
    """
    if dataset is None:
        data_path = Path("data/starter_dataset/cit_public.json")
        if data_path.exists():
            with open(data_path, "r", encoding="utf-8") as f:
                dataset = json.load(f)
        else:
            dataset = {"faculty": [], "booking_requests": []}

    config = load_accounts_config()
    role_passwords = config.get("role_passwords", {
        "admin": "Admin@123",
        "department_coordinator": "Coord@123",
        "faculty": "Faculty@123",
        "club": "Club@123"
    })

    # Hash each role password exactly once
    cached_hashes = {
        role: get_password_hash(pwd)
        for role, pwd in role_passwords.items()
    }

    accounts_spec = build_accounts_list(dataset)
    seeded_users: List[User] = []

    for spec in accounts_spec:
        email = spec["email"].lower()
        role = spec["role"]
        pwd_hash = cached_hashes.get(role, cached_hashes.get("faculty"))

        user = db.query(User).filter(User.email == email).first()
        if user:
            # Update fields
            user.name = spec["name"]
            user.role = spec["role"]
            user.department = spec["department"]
            user.faculty_id = spec["faculty_id"]
            user.club_name = spec["club_name"]
            user.password_hash = pwd_hash
        else:
            user = User(
                id=spec["id"],
                name=spec["name"],
                email=email,
                password_hash=pwd_hash,
                role=spec["role"],
                department=spec["department"],
                faculty_id=spec["faculty_id"],
                club_name=spec["club_name"]
            )
            db.add(user)
        seeded_users.append(user)

    db.commit()
    return seeded_users

