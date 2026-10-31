"""
Unified Rules Engine for CIT Campus Scheduling.
Pure deterministic Python evaluator wrapping timetable, fest_week, exam, and stability checks.
"""
from typing import Dict, List, Tuple, Any, Optional
from backend.app.rules.models import DatasetContext
from backend.app.rules.timetable import validate_full_timetable, compute_soft_penalties
from backend.app.rules.bookings import validate_fest_week
from backend.app.rules.exams import validate_exams


def to_assign(sched: Dict[str, Any]) -> Tuple[Dict[str, Tuple[str, int, str]], List[str]]:
    out = {}
    dup = []
    for e in sched.get("sessions", []):
        sid = e.get("session_id")
        if sid in out:
            dup.append(sid)
        out[sid] = (e.get("day"), e.get("start_period"), e.get("room_id"))
    return out, dup


def evaluate_schedule(
    data: Dict[str, Any],
    sched: Dict[str, Any],
    baseline: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Evaluates a schedule against dataset and optional baseline.
    Returns a full dictionary with hard_violations, soft_penalties, bookings, exams, stability.
    Matches the schema and logic of validator.py run().
    """
    ctx = DatasetContext.from_dict(data)
    report: Dict[str, Any] = {
        "dataset_id": data.get("dataset_id"),
        "schedule_dataset_id": sched.get("dataset_id"),
        "team": sched.get("team"),
    }

    assign, dup = to_assign(sched)
    V, _ = validate_full_timetable(ctx, assign, "timetable")
    for d in dup:
        V.append({"rule": "H1", "where": "timetable", "detail": f"Session {d} appears more than once"})

    soft, total = compute_soft_penalties(ctx, assign)
    report["soft_penalties"] = soft
    report["soft_total"] = total
    W = []

    if "fest_week" in sched:
        bv, bw, bstats = validate_fest_week(ctx, assign, sched["fest_week"])
        V += bv
        W += bw
        report["bookings"] = bstats

    # Exams: checked if present or if baseline is None
    if data.get("exams") and (baseline is None or sched.get("exams")):
        ev, epen = validate_exams(ctx, sched.get("exams") or [])
        V += ev
        report["exam_soft_penalty"] = epen

    if baseline is not None:
        b, _ = to_assign(baseline)
        moved = [
            sid for sid in assign
            if sid in b and sid in ctx.sessions and tuple(assign[sid]) != tuple(b[sid])
        ]
        report["stability"] = {
            "sessions_moved": len(moved),
            "time_changed": sum(1 for s in moved if assign[s][:2] != b[s][:2]),
            "room_only_changed": sum(1 for s in moved if assign[s][:2] == b[s][:2]),
            "moved_ids": sorted(moved),
        }

    # Deduplicate violations while preserving order
    seen, uniq = set(), []
    for x in V:
        k = (x["rule"], x["detail"])
        if k not in seen:
            seen.add(k)
            uniq.append(x)
    V = uniq

    report["hard_violations"] = V
    report["hard_violation_count"] = len(V)
    report["hard_by_rule"] = {}
    for x in V:
        rule_key = x["rule"]
        report["hard_by_rule"][rule_key] = report["hard_by_rule"].get(rule_key, 0) + 1
    report["warnings"] = W
    return report

