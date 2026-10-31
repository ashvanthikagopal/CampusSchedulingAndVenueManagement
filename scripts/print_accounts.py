"""
Script to print all 62 accounts generated from dataset in Markdown format.
"""
import json
import sys
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from backend.app.core.seed_users import build_accounts_from_dataset, load_accounts_config


def main():
    dataset_path = root_dir / "data" / "starter_dataset" / "cit_public.json"
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    accounts = build_accounts_from_dataset(data)
    cfg = load_accounts_config()
    pwds = cfg["role_passwords"]

    print("| # | Role | Name | Identifier / Email | Faculty ID / Dept / Club | Demo Password |")
    print("|---|---|---|---|---|---|")
    for i, a in enumerate(accounts, 1):
        extra = a.get("faculty_id") or a.get("club_name") or a.get("department") or "-"
        pwd = pwds.get(a["role"], "-")
        print(f"| {i} | `{a['role']}` | {a['name']} | `{a['email']}` | {extra} | `{pwd}` |")


if __name__ == "__main__":
    main()

