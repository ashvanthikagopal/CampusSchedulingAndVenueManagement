"""
Deterministic rules for timetable validation (H1-H12, H14, S1-S6).
Matches official validator.py exactly.
"""
from typing import Dict, List, Tuple, Set, Any
from collections import defaultdict
from backend.app.rules.models import DatasetContext, Session, LAST_TEACHING


def block(start: int, dur: int) -> List[int]:
    return list(range(start, start + dur))


def check_h1(ctx: DatasetContext, assign: Dict[str, Tuple[str, int, str]], where: str = "timetable") -> List[Dict[str, Any]]:
    """H1: Every session exactly once, known session, valid day, known room."""
    violations = []
    for sid in ctx.sessions:
        if sid not in assign:
            violations.append({"rule": "H1", "where": where, "detail": f"Session {sid} is not scheduled"})
    for sid, (day, start, rid) in assign.items():
        s = ctx.sessions.get(sid)
        if s is None:
            violations.append({"rule": "H1", "where": where, "detail": f"Unknown session id {sid}"})
            continue
        if day not in ctx.days:
            violations.append({"rule": "H1", "where": where, "detail": f"{sid}: invalid day {day}"})
            continue
        r = ctx.rooms.get(rid)
        if r is None:
            violations.append({"rule": "H1", "where": where, "detail": f"{sid}: unknown room {rid}"})
            continue
    return violations


def check_h9(ctx: DatasetContext, sid: str, s: Session, day: str, start: int, where: str = "timetable") -> List[Dict[str, Any]]:
    """H9: Session within P1-P9, no lunch crossing, labs start only at P2 or P6."""
    violations = []
    if not isinstance(start, int) or start < 1 or start + s.duration - 1 > LAST_TEACHING:
        violations.append({
            "rule": "H9",
            "where": where,
            "detail": f"{sid}: start period {start} with duration {s.duration} runs outside P1-P9"
        })
        return violations
    per = block(start, s.duration)
    if per[0] <= ctx.lunch_after < per[-1]:
        violations.append({
            "rule": "H9",
            "where": where,
            "detail": f"{sid}: crosses lunch ({day} P{per[0]}-P{per[-1]})"
        })
    if s.kind == "lab" and start not in ctx.lab_starts:
        violations.append({
            "rule": "H9",
            "where": where,
            "detail": f"{sid}: lab must start at P2 or P6, starts at P{start}"
        })
    return violations


def check_h14(sid: str, s: Session, day: str, start: int, where: str = "timetable") -> List[Dict[str, Any]]:
    """H14: Must match fixed_slot if defined."""
    violations = []
    fx = s.fixed_slot
    if fx and (fx.get("day") != day or fx.get("start_period") != start):
        violations.append({
            "rule": "H14",
            "where": where,
            "detail": f"{sid}: fixed at {fx.get('day')} P{fx.get('start_period')}, placed at {day} P{start}"
        })
    return violations


def check_h5(ctx: DatasetContext, sid: str, s: Session, rid: str, where: str = "timetable") -> List[Dict[str, Any]]:
    """H5: Room capacity >= session size."""
    violations = []
    r = ctx.rooms.get(rid)
    if r and r.capacity < s.size:
        violations.append({
            "rule": "H5",
            "where": where,
            "detail": f"{sid}: size {s.size} > {rid} capacity {r.capacity}"
        })
    return violations


def check_h6(ctx: DatasetContext, sid: str, s: Session, rid: str, where: str = "timetable") -> List[Dict[str, Any]]:
    """H6: Room type in session.room_types."""
    violations = []
    r = ctx.rooms.get(rid)
    if r and r.type not in s.room_types:
        violations.append({
            "rule": "H6",
            "where": where,
            "detail": f"{sid}: needs {s.room_types}, {rid} is {r.type}"
        })
    return violations


def check_h10(ctx: DatasetContext, sid: str, s: Session, rid: str, where: str = "timetable") -> List[Dict[str, Any]]:
    """H10: session.needs_accessible requires room.accessible."""
    violations = []
    r = ctx.rooms.get(rid)
    if r and s.needs_accessible and not r.accessible:
        violations.append({
            "rule": "H10",
            "where": where,
            "detail": f"{sid}: needs an accessible room, {rid} is not"
        })
    return violations


def validate_full_timetable(ctx: DatasetContext, assign: Dict[str, Tuple[str, int, str]], label: str = "timetable") -> Tuple[List[Dict[str, Any]], Dict[Tuple[str, str, int], Set[str]]]:
    """
    Validates complete timetable assignments against H1-H12, H14.
    Returns (violations_list, grp_occupancy_dict) exactly as validator.py does.
    """
    V = []
    def v(rule: str, msg: str):
        V.append({"rule": rule, "where": label, "detail": msg})

    room_occ = defaultdict(list)
    fac_occ = defaultdict(list)
    grp_occ = defaultdict(set)
    fac_day = defaultdict(int)
    basket_time = defaultdict(set)

    for sid in ctx.sessions:
        if sid not in assign:
            v("H1", f"Session {sid} is not scheduled")

    for sid, (day, start, rid) in assign.items():
        s = ctx.sessions.get(sid)
        if s is None:
            v("H1", f"Unknown session id {sid}")
            continue
        if day not in ctx.days:
            v("H1", f"{sid}: invalid day {day}")
            continue
        if not isinstance(start, int) or start < 1 or start + s.duration - 1 > LAST_TEACHING:
            v("H9", f"{sid}: start period {start} with duration {s.duration} runs outside P1-P9")
            continue
        r = ctx.rooms.get(rid)
        if r is None:
            v("H1", f"{sid}: unknown room {rid}")
            continue

        per = block(start, s.duration)
        if per[0] <= ctx.lunch_after < per[-1]:
            v("H9", f"{sid}: crosses lunch ({day} P{per[0]}-P{per[-1]})")
        if s.kind == "lab" and start not in ctx.lab_starts:
            v("H9", f"{sid}: lab must start at P2 or P6, starts at P{start}")
        fx = s.fixed_slot
        if fx and (fx.get("day") != day or fx.get("start_period") != start):
            v("H14", f"{sid}: fixed at {fx.get('day')} P{fx.get('start_period')}, placed at {day} P{start}")
        if r.capacity < s.size:
            v("H5", f"{sid}: size {s.size} > {rid} capacity {r.capacity}")
        if r.type not in s.room_types:
            v("H6", f"{sid}: needs {s.room_types}, {rid} is {r.type}")
        if s.needs_accessible and not r.accessible:
            v("H10", f"{sid}: needs an accessible room, {rid} is not")

        f = s.faculty_id
        for p in per:
            room_occ[(rid, day, p)].append(sid)
            fac_occ[(f, day, p)].append(sid)
            key = s.basket_slot or sid
            for g in s.groups:
                grp_occ[(g, day, p)].add(key)
            if (day, p) in ctx.faculty_unavailability.get(f, set()):
                v("H7", f"{sid}: {f} unavailable {day} P{p}")
            if (day, p) in ctx.room_unavailability.get(rid, set()):
                v("H8", f"{sid}: {rid} unavailable {day} P{p}")
        fac_day[(f, day)] += s.duration
        if s.basket_slot:
            basket_time[s.basket_slot].add((day, start))

    for (rid, day, p), sids in room_occ.items():
        if len(sids) > 1:
            v("H4", f"{rid} double-booked {day} P{p}: {', '.join(sorted(sids))}")
    for (f, day, p), sids in fac_occ.items():
        if len(sids) > 1:
            v("H2", f"{f} double-booked {day} P{p}: {', '.join(sorted(sids))}")
    for (g, day, p), keys in grp_occ.items():
        if len(keys) > 1:
            v("H3", f"Group {g} double-booked {day} P{p}: {', '.join(sorted(keys))}")
    for b, times in basket_time.items():
        if len(times) > 1:
            v("H11", f"Basket {b} sessions are not at the same time: {sorted(times)}")
    for (f, day), h in fac_day.items():
        fac_obj = ctx.faculty.get(f)
        mx = fac_obj.max_hours_per_day if fac_obj else 4
        if h > mx:
            v("H12", f"{f} teaches {h} hours on {day} (max {mx})")

    return V, grp_occ


def compute_soft_penalties(ctx: DatasetContext, assign: Dict[str, Tuple[str, int, str]]) -> Tuple[Dict[str, int], int]:
    """
    Computes soft penalties S1-S6 matching validator.py formula exactly.
    """
    pen = defaultdict(int)
    grp_day = defaultdict(set)
    grp_hours = defaultdict(int)
    grp_course = defaultdict(int)
    seen_basket = set()

    for sid, (day, start, rid) in assign.items():
        s = ctx.sessions.get(sid)
        r = ctx.rooms.get(rid)
        if s is None or r is None:
            continue
        per = block(start, s.duration)
        fac_obj = ctx.faculty.get(s.faculty_id)
        if fac_obj:
            for pref in fac_obj.preferences:
                if pref.get("type") == "avoid" and day in pref.get("days", ctx.days):
                    pen["S1"] += 2 * sum(1 for p in per if p in pref.get("periods", []))
        if r.capacity and s.size / r.capacity < 0.4:
            pen["S5"] += 1
        if LAST_TEACHING in per:
            pen["S6"] += 1

        for g in s.groups:
            for p in per:
                grp_day[(g, day)].add(p)
            if s.basket_slot:
                if (g, s.basket_slot) in seen_basket:
                    continue
                seen_basket.add((g, s.basket_slot))
            grp_hours[(g, day)] += s.duration
            if s.kind == "lecture" and not s.basket_slot:
                grp_course[(g, day, s.course_id)] += 1

    for (g, day), ps in grp_day.items():
        pen["S2"] += sum(1 for p in range(min(ps), max(ps) + 1) if p not in ps)
    for k, h in grp_hours.items():
        if h > 6:
            pen["S3"] += 3 * (h - 6)
    for k, c in grp_course.items():
        if c > 1:
            pen["S4"] += 3 * (c - 1)

    # Basket lectures of the same course twice in a day
    bc = defaultdict(int)
    for sid, (day, start, rid) in assign.items():
        s = ctx.sessions.get(sid)
        if s and s.basket_slot:
            bc[(s.course_id, day)] += 1
    for k, c in bc.items():
        if c > 1:
            pen["S4"] += 3 * (c - 1)

    for k in ("S1", "S2", "S3", "S4", "S5", "S6"):
        pen.setdefault(k, 0)

    return dict(sorted(pen.items())), sum(pen.values())

