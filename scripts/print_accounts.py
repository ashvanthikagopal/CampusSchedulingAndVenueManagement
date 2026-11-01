"""
Script to display and format all 62 rule-based demo accounts generated from cit_public.json.
Generates Markdown tables for README.md and documentation.
"""
import json
import re
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT_DIR / "backend" / "app" / "core" / "accounts_config.json"
DATASET_PATH = ROOT_DIR / "data" / "starter_dataset" / "cit_public.json"


def generate_club_slug(club_name: str) -> str:
    cleaned = re.sub(r'(?i)\b(club|society)\b', '', club_name)
    slug = re.sub(r'[^a-zA-Z0-9]', '', cleaned).lower()
    return slug


def get_all_accounts():
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)

    passwords = config.get("role_passwords", {
        "admin": "Admin@123",
        "department_coordinator": "Coord@123",
        "faculty": "Faculty@123",
        "club": "Club@123"
    })

    accounts = []

    # 1. Admins
    for a in config.get("admins", []):
        accounts.append({
            "category": "Admin",
            "name": a["name"],
            "department": a.get("department", "Administration"),
            "extra_id": "-",
            "email": a["email"].lower(),
            "password": passwords["admin"]
        })

    # 2. Coordinators
    faculty_list = dataset.get("faculty", [])
    depts = sorted(list(set(
        f["department"] for f in faculty_list
        if f.get("department") and f["department"] != "ADMIN"
    )))
    for d in depts:
        accounts.append({
            "category": "Coordinator",
            "name": f"{d} Department Coordinator",
            "department": d,
            "extra_id": "-",
            "email": f"coord_{d.lower()}@cit.edu",
            "password": passwords["department_coordinator"]
        })

    for sc in config.get("special_coordinators", []):
        accounts.append({
            "category": "Coordinator",
            "name": sc["name"],
            "department": sc.get("department", "CSE"),
            "extra_id": "-",
            "email": sc["email"].lower(),
            "password": passwords["department_coordinator"]
        })

    # 3. Faculty
    for f in faculty_list:
        fid = f["id"]
        accounts.append({
            "category": "Faculty",
            "name": f["name"],
            "department": f.get("department", "-"),
            "extra_id": fid,
            "email": f"faculty_{fid.lower()}@cit.edu",
            "password": passwords["faculty"]
        })

    # 4. Clubs
    reqs = dataset.get("booking_requests", [])
    seen_clubs = []
    for r in reqs:
        if r.get("role") == "club":
            c_name = r.get("requester")
            if c_name and c_name not in seen_clubs:
                seen_clubs.append(c_name)

    for club_name in seen_clubs:
        slug = generate_club_slug(club_name)
        accounts.append({
            "category": "Club",
            "name": club_name,
            "department": "-",
            "extra_id": slug,
            "email": f"club_{slug}@cit.edu",
            "password": passwords["club"]
        })

    return accounts


def print_markdown_report():
    accounts = get_all_accounts()
    print(f"Total Accounts: {len(accounts)}\n")
    print("### Role Passwords Table\n")
    print("| Role | Scope & Permissions | Demo Password | Email Pattern |")
    print("| :--- | :--- | :--- | :--- |")
    print("| **Campus Admin** | Full schedule control, institute events, system reset | `Admin@123` | `admin@cit.edu`, `admin2@cit.edu` |")
    print("| **Department Coordinator** | Dept schedule & lab booking approvals | `Coord@123` | `coord_<dept>@cit.edu`, `coord_tnp@cit.edu` |")
    print("| **Faculty** | Personal timetable & unavailability requests | `Faculty@123` | `faculty_<fid>@cit.edu` or Faculty ID (`F01`-`F40`) |")
    print("| **Club Representative** | Student booking requests & clash tracking | `Club@123` | `club_<slug>@cit.edu` |")
    print("\n")

    print("<details>")
    print("<summary><strong>Click to expand all 62 rule-generated accounts</strong></summary>\n")
    print("| # | Role | Name | Dept | ID / Slug | Email (or Login Identifier) | Password |")
    print("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |")
    for i, a in enumerate(accounts, 1):
        print(f"| {i} | {a['category']} | {a['name']} | {a['department']} | {a['extra_id']} | `{a['email']}` | `{a['password']}` |")
    print("\n</details>")


if __name__ == "__main__":
    print_markdown_report()

