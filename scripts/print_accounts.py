"""
Script to print all 62 rule-generated demo accounts in Markdown table format for README.md.
"""
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import json
from backend.app.core.seed_users import build_accounts_list, load_accounts_config


def main():
    dataset_path = Path("data/starter_dataset/cit_public.json")
    with open(dataset_path, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    accounts = build_accounts_list(dataset)
    config = load_accounts_config()
    passwords = config.get("role_passwords", {})

    print(f"Total Accounts Generated: {len(accounts)}\n")

    # Group accounts
    admins = [a for a in accounts if a["role"] == "admin"]
    coords = [a for a in accounts if a["role"] == "department_coordinator"]
    faculty = [a for a in accounts if a["role"] == "faculty"]
    clubs = [a for a in accounts if a["role"] == "club"]

    print("### Admins (Password: `" + passwords.get("admin", "Admin@123") + "`)")
    print("| Name | Email | Role | Department |")
    print("| :--- | :--- | :--- | :--- |")
    for a in admins:
        print(f"| {a['name']} | `{a['email']}` | Admin | {a['department']} |")

    print("\n### Department Coordinators (Password: `" + passwords.get("department_coordinator", "Coord@123") + "`)")
    print("| Name | Email | Department |")
    print("| :--- | :--- | :--- |")
    for a in coords:
        print(f"| {a['name']} | `{a['email']}` | {a['department']} |")

    print("\n### Clubs (Password: `" + passwords.get("club", "Club@123") + "`)")
    print("| Club Name | Email | Role |")
    print("| :--- | :--- | :--- |")
    for a in clubs:
        print(f"| {a['club_name']} | `{a['email']}` | Club Representative |")

    print("\n### Faculty Members (Password: `" + passwords.get("faculty", "Faculty@123") + "`)")
    print("| Faculty ID | Name | Department | Email |")
    print("| :--- | :--- | :--- | :--- |")
    for a in faculty:
        print(f"| {a['faculty_id']} | {a['name']} | {a['department']} | `{a['email']}` |")


if __name__ == "__main__":
    main()
