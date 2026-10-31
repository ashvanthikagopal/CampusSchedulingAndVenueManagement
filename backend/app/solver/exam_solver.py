"""
Google OR-Tools CP-SAT Midsem Exam Scheduler.
Pure Python solver with zero FastAPI or database dependencies.
Schedules all 41 midsem exams with half-capacity arithmetic, 0 hard violations,
and minimizes the 5-point group same-day penalty.
"""
from typing import Dict, List, Tuple, Set, Any, Optional
from collections import defaultdict
import time
from ortools.sat.python import cp_model

from backend.app.rules.models import DatasetContext


def solve_exams(
    ctx: DatasetContext,
    time_limit_seconds: float = 30.0,
    num_workers: int = 8,
    random_seed: int = 42
) -> Tuple[str, Optional[List[Dict[str, Any]]], Dict[str, Any]]:
    """
    Schedules all exams in the exam week (MON-SAT, AM/PM).
    Returns (status_name, list_of_exam_assignments, stats).
    exam_assignment: {"exam_id": eid, "day": day, "session": session, "rooms": [r1, r2, ...]}
    """
    model = cp_model.CpModel()
    start_time = time.time()

    data = ctx.raw_data
    exams = data.get("exams", [])
    if not exams:
        return "FEASIBLE", [], {"status": "NO_EXAMS"}

    cal = data.get("calendar", {}).get("exam_week", {})
    days = cal.get("days", ["MON", "TUE", "WED", "THU", "FRI", "SAT"])
    sessions = [s["id"] for s in cal.get("sessions", [])]  # ["AM", "PM"]

    slots = [(d, s) for d in days for s in sessions]

    # Available exam rooms: allowed_uses includes "exam"
    exam_rooms = [
        r for r in ctx.rooms.values()
        if "exam" in r.allowed_uses
    ]
    # Sort rooms by capacity descending so larger rooms are preferred before fragmenting
    exam_rooms.sort(key=lambda r: r.capacity, reverse=True)

    # 1. Variables
    # slot_var[e_id, d, s]: 1 if exam is scheduled at (d, s)
    slot_var: Dict[Tuple[str, str, str], cp_model.IntVar] = {}
    # room_var[e_id, d, s, r_id]: 1 if exam uses room r_id at (d, s)
    room_var: Dict[Tuple[str, str, str, str], cp_model.IntVar] = {}

    for e in exams:
        eid = e["id"]
        for (d, s) in slots:
            slot_v = model.NewBoolVar(f"exam_{eid}_{d}_{s}")
            slot_var[(eid, d, s)] = slot_v

            for r in exam_rooms:
                # Do not use LH-4 on Thursday (ceiling repair)
                if r.id == "LH-4" and d == "THU":
                    continue
                rm_v = model.NewBoolVar(f"room_{eid}_{d}_{s}_{r.id}")
                room_var[(eid, d, s, r.id)] = rm_v
                # Can only use room if exam is scheduled in this slot
                model.Add(rm_v <= slot_v)

    # 2. Constraints
    # Each exam scheduled exactly once
    for e in exams:
        eid = e["id"]
        model.AddExactlyOne([slot_var[(eid, d, s)] for (d, s) in slots])

    # No group sits two exams in the same slot
    for g in ctx.student_groups:
        for (d, s) in slots:
            participating_exams = [
                slot_var[(e["id"], d, s)]
                for e in exams
                if g in e.get("groups", [])
            ]
            if len(participating_exams) > 1:
                model.Add(sum(participating_exams) <= 1)

    # Room at most once per slot
    for r in exam_rooms:
        for (d, s) in slots:
            using_exams = [
                room_var[(e["id"], d, s, r.id)]
                for e in exams
                if (e["id"], d, s, r.id) in room_var
            ]
            if len(using_exams) > 1:
                model.Add(sum(using_exams) <= 1)

    # Capacity constraint: sum of capacity // 2 >= exam.size
    for e in exams:
        eid = e["id"]
        size = e["size"]
        for (d, s) in slots:
            slot_v = slot_var[(eid, d, s)]
            effective_seats = sum(
                (r.capacity // 2) * room_var[(eid, d, s, r.id)]
                for r in exam_rooms
                if (eid, d, s, r.id) in room_var
            )
            # When slot_v == 1, effective_seats >= size
            model.Add(effective_seats >= size).OnlyEnforceIf(slot_v)

    # 3. Objective
    objective_terms = []

    # Minimise 5-point penalty for a group sitting two exams on the same day
    for g in ctx.student_groups:
        for d in days:
            day_exam_slots = [
                slot_var[(e["id"], d, s)]
                for e in exams
                if g in e.get("groups", [])
                for s in sessions
            ]
            if len(day_exam_slots) > 1:
                day_excess = model.NewIntVar(0, len(day_exam_slots), f"excess_{g}_{d}")
                model.Add(sum(day_exam_slots) - 1 <= day_excess)
                objective_terms.append(500 * day_excess)

    # Secondary objective: prefer fewer rooms per exam (minimize room fragmentation)
    for (key, rm_v) in room_var.items():
        objective_terms.append(10 * rm_v)

    model.Minimize(sum(objective_terms))

    # 4. Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.num_search_workers = num_workers
    solver.parameters.random_seed = random_seed

    status_code = solver.Solve(model)
    status_map = {
        cp_model.OPTIMAL: "OPTIMAL",
        cp_model.FEASIBLE: "FEASIBLE",
        cp_model.INFEASIBLE: "INFEASIBLE",
        cp_model.MODEL_INVALID: "MODEL_INVALID",
        cp_model.UNKNOWN: "UNKNOWN"
    }
    status_str = status_map.get(status_code, "UNKNOWN")
    solve_time = time.time() - start_time

    stats = {
        "status": status_str,
        "solve_seconds": round(solve_time, 2),
        "wall_time": solver.WallTime(),
        "branches": solver.NumBranches(),
        "conflicts": solver.NumConflicts(),
    }

    if status_str not in ("OPTIMAL", "FEASIBLE"):
        return status_str, None, stats

    # 5. Extract assignments
    assignments = []
    for e in exams:
        eid = e["id"]
        chosen_slot = None
        for (d, s) in slots:
            if solver.Value(slot_var[(eid, d, s)]) == 1:
                chosen_slot = (d, s)
                break
        if chosen_slot:
            d, s = chosen_slot
            chosen_rooms = [
                r.id for r in exam_rooms
                if (eid, d, s, r.id) in room_var and solver.Value(room_var[(eid, d, s, r.id)]) == 1
            ]
            assignments.append({
                "exam_id": eid,
                "day": d,
                "session": s,
                "rooms": chosen_rooms
            })

    return status_str, assignments, stats

