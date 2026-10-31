"""
Deterministic rules for Midsem Exam scheduling (E1, E2, H3, H4, H5, and exam soft penalty).
Matches official validator.py exactly.
"""
from typing import Dict, List, Tuple, Set, Any
from collections import defaultdict
from backend.app.rules.models import DatasetContext


def validate_exams(ctx: DatasetContext, exams_out: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], int]:
    """
    Validates exam assignments.
    Returns (violations, exam_soft_penalty) matching validator.py check_exams.
    """
    data = ctx.raw_data
    V = []
    pen = 0
    ex = {e["id"]: e for e in data.get("exams", [])}
    cal = data.get("calendar", {}).get("exam_week", {})
    cal_days = cal.get("days", ["MON", "TUE", "WED", "THU", "FRI", "SAT"])
    sess_ids = {s["id"] for s in cal.get("sessions", [])}

    room_use = defaultdict(list)
    grp_use = defaultdict(list)
    grp_day = defaultdict(set)
    seen = set()

    for e in exams_out:
        eid = e.get("exam_id")
        if eid not in ex:
            V.append({"rule": "E1", "where": "exams", "detail": f"Unknown exam {eid}"})
            continue
        if eid in seen:
            V.append({"rule": "E1", "where": "exams", "detail": f"{eid} scheduled twice"})
        seen.add(eid)

        day = e.get("day")
        session_slot = e.get("session")
        if day not in cal_days or session_slot not in sess_ids:
            V.append({"rule": "E1", "where": "exams", "detail": f"{eid}: invalid slot"})
            continue

        seats = 0
        for rid in e.get("rooms", []):
            r = ctx.rooms.get(rid)
            if r is None or "exam" not in r.allowed_uses:
                V.append({"rule": "E2", "where": "exams", "detail": f"{eid}: {rid} cannot host exams"})
                continue
            seats += r.capacity // 2
            room_use[(rid, day, session_slot)].append(eid)

        if seats < ex[eid]["size"]:
            V.append({
                "rule": "H5",
                "where": "exams",
                "detail": f"{eid}: {seats} seats at half capacity for {ex[eid]['size']} students"
            })

        for g in ex[eid]["groups"]:
            grp_use[(g, day, session_slot)].append(eid)
            grp_day[(g, day)].add(eid)

    for eid in ex:
        if eid not in seen:
            V.append({"rule": "E1", "where": "exams", "detail": f"{eid} not scheduled"})

    for k, v in room_use.items():
        if len(v) > 1:
            V.append({"rule": "H4", "where": "exams", "detail": f"{k[0]} has {v} in {k[1]} {k[2]}"})

    for k, v in grp_use.items():
        if len(v) > 1:
            V.append({"rule": "H3", "where": "exams", "detail": f"Group {k[0]} has {v} in {k[1]} {k[2]}"})

    for k, v in grp_day.items():
        if len(v) > 1:
            pen += 5 * (len(v) - 1)

    return V, pen

