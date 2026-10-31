"""
Test script to run the CP-SAT Timetable Solver on cit_public.json,
verify 0 hard violations with official validator.py, and display soft penalty summary.
"""
import json
import sys
import time
from pathlib import Path

from backend.app.rules.models import DatasetContext
from backend.app.solver.timetable_solver import solve_timetable
from backend.app.rules.engine import evaluate_schedule
from backend.validator.validator import run as official_validator_run

def main():
    data_path = Path("data/starter_dataset/cit_public.json")
    with open(data_path, encoding="utf-8") as f:
        data = json.load(f)

    print("Building DatasetContext...")
    ctx = DatasetContext.from_dict(data)
    print(f"Loaded: {len(ctx.sessions)} sessions, {len(ctx.rooms)} rooms, {len(ctx.faculty)} faculty")

    print("Running CP-SAT solver (30s limit, 8 workers)...")
    t0 = time.time()
    status, assign, stats = solve_timetable(ctx, time_limit_seconds=30.0, num_workers=8)
    elapsed = time.time() - t0
    print(f"Solver returned: {status} in {elapsed:.2f}s. Stats: {stats}")

    if not assign:
        print("Solving failed!")
        sys.exit(1)

    # Format into standard schedule structure
    sessions_list = [
        {"session_id": sid, "day": day, "start_period": start, "room_id": rid}
        for sid, (day, start, rid) in sorted(assign.items())
    ]
    sched = {
        "team": "CIT Scheduler Team",
        "dataset_id": data["dataset_id"],
        "sessions": sessions_list
    }

    # Validate with official validator.py
    print("\n--- Official Validator.py Report ---")
    val_report = official_validator_run(data, sched)
    print(f"Hard violations: {val_report['hard_violation_count']} {val_report['hard_by_rule']}")
    print(f"Soft total: {val_report['soft_total']}")
    print(f"Soft breakdown: {val_report['soft_penalties']}")

    if val_report["hard_violation_count"] != 0:
        print("ERROR: Hard violations found!")
        for x in val_report["hard_violations"]:
            print(f"  [{x['rule']}] {x['detail']}")
        sys.exit(1)
    else:
        print("\nSUCCESS! Exactly 0 hard violations verified by official validator.py!")

if __name__ == "__main__":
    main()

