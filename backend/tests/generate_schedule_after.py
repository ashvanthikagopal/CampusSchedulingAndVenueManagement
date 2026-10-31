"""
Script to apply sample_disruption.json, repair schedule with minimal change,
save exports/schedule_after.json, and run official validator.py.
"""
import json
import os
import sys
from pathlib import Path

from backend.app.solver.repair_engine import repair_schedule
from backend.validator.validator import run as official_validator_run, apply_disruption as official_apply_disruption

def main():
    data_path = Path("data/starter_dataset/cit_public.json")
    disruption_path = Path("starter_pack/examples/sample_disruption.json")
    baseline_path = Path("exports/schedule.json")
    output_path = Path("exports/schedule_after.json")

    with open(data_path, encoding="utf-8") as f:
        base_data = json.load(f)
    with open(disruption_path, encoding="utf-8") as f:
        disruption = json.load(f)
    with open(baseline_path, encoding="utf-8") as f:
        base_schedule = json.load(f)

    print("=== Testing Schedule Repair Engine ===")
    status, schedule_after, proposal = repair_schedule(
        base_data=base_data,
        disruption=disruption,
        base_schedule=base_schedule,
        time_limit_seconds=40.0
    )

    print(f"Repair Status: {status}")
    print(f"Moved Sessions: {proposal.get('moved_count')}")
    print(f"Time changed: {proposal.get('time_changed_count')}, Room only changed: {proposal.get('room_only_changed_count')}")
    for m in proposal.get("moved_sessions", []):
        print(f"  - {m['session_id']}: {m['before']} -> {m['after']}")

    if not schedule_after:
        print("ERROR: Repair failed!")
        sys.exit(1)

    os.makedirs(output_path.parent, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(schedule_after, f, indent=2)
    print(f"\nSaved repaired schedule to: {output_path}")

    # Run official validator
    print("\n=== Running Official validator.py on schedule_after.json ===")
    new_data = official_apply_disruption(base_data, disruption)
    rep = official_validator_run(new_data, schedule_after, baseline=base_schedule)

    print(f"Hard violations: {rep['hard_violation_count']} {rep['hard_by_rule']}")
    print(f"Soft penalty total: {rep['soft_total']} {rep['soft_penalties']}")
    if "stability" in rep:
        s = rep["stability"]
        print(f"Stability: {s['sessions_moved']} sessions moved ({s['time_changed']} time, {s['room_only_changed']} room only)")
    if "bookings" in rep:
        b = rep["bookings"]
        print(f"Bookings: score {b['booking_score']}/{b['booking_score_max_if_all_approved']} | approved {b['approved']}, alt {b['alternatives']}, rej {b['rejected']}, inversions {len(b['priority_inversions'])}")

    if rep["hard_violation_count"] != 0:
        print("ERROR: Hard violations found in repaired schedule!")
        for x in rep["hard_violations"]:
            print(f"  [{x['rule']}] {x['detail']}")
        sys.exit(1)
    else:
        print("\nSUCCESS! Exactly 0 hard violations on repaired schedule!")

if __name__ == "__main__":
    main()

