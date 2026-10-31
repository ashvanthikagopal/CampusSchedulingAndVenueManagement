"""
Deterministic rules for Spectra Week bookings (B1, B2, B3, H13, and priority inversions).
Matches official validator.py exactly.
"""
from typing import Dict, List, Tuple, Set, Any
from collections import defaultdict
from backend.app.rules.models import DatasetContext, BookingRequest, CAT_WEIGHT, MAX_PERIOD, effective_category, outranks
from backend.app.rules.timetable import validate_full_timetable, block


def validate_fest_week(
    ctx: DatasetContext,
    base_assign: Dict[str, Tuple[str, int, str]],
    fest: Dict[str, Any]
) -> Tuple[List[Dict[str, Any]], List[str], Dict[str, Any]]:
    """
    Validates fest_week structure against base timetable assignment.
    Returns (violations, warnings, stats) exactly matching validator.py check_bookings.
    """
    V, W = [], []
    data = ctx.raw_data
    overrides = fest.get("session_overrides", [])
    decisions = fest.get("bookings", [])
    dec_by = {}

    for d in decisions:
        req_id = d.get("request_id")
        if req_id in dec_by:
            V.append({"rule": "B1", "where": "fest_week", "detail": f"Two decisions for {req_id}"})
        dec_by[req_id] = d

    # week-7 timetable view
    week = dict(base_assign)
    for o in overrides:
        sid = o.get("session_id")
        if sid not in ctx.sessions:
            V.append({"rule": "B2", "where": "fest_week", "detail": f"Override for unknown session {sid}"})
            continue
        disp_req_id = o.get("displaced_by")
        disp = dec_by.get(disp_req_id)
        req = ctx.booking_requests.get(disp_req_id)
        if not req or not disp or disp.get("status") != "approved":
            V.append({
                "rule": "B2",
                "where": "fest_week",
                "detail": f"Override of {sid} names {disp_req_id}, which is not an approved booking"
            })
        elif ctx.priority_order.index(effective_category(ctx, req)) > ctx.priority_order.index("institute_event"):
            V.append({
                "rule": "B2",
                "where": "fest_week",
                "detail": f"{disp_req_id} ({effective_category(ctx, req)}) is not allowed to displace a regular session"
            })
        week[sid] = (o["day"], o["start_period"], o["room_id"])

    wv, wgrp = validate_full_timetable(ctx, week, "fest_week")
    V += wv

    room_busy = defaultdict(list)
    for sid, (day, start, rid) in week.items():
        s = ctx.sessions.get(sid)
        if s:
            for p in block(start, s.duration):
                room_busy[(rid, day, p)].append(sid)

    score = 0.0
    max_score = 0
    placed = {}

    for rid_, req in ctx.booking_requests.items():
        if rid_ not in ctx.cancellations:
            max_score += CAT_WEIGHT[effective_category(ctx, req)]

    for req_id, req in ctx.booking_requests.items():
        d = dec_by.get(req_id)
        if d is None:
            W.append(f"No decision for {req_id}")
            continue
        st = d.get("status")
        if req_id in ctx.cancellations:
            if st in ("approved", "alternative_offered"):
                V.append({"rule": "B3", "where": "fest_week", "detail": f"{req_id} was cancelled but is {st}"})
            continue
        if st not in ("approved", "rejected", "alternative_offered"):
            V.append({"rule": "B1", "where": "fest_week", "detail": f"{req_id}: unknown status {st}"})
            continue
        if st in ("rejected", "alternative_offered") and not str(d.get("reason", "")).strip():
            W.append(f"{req_id}: {st} without a reason")
        if st == "rejected":
            continue

        ok = True
        def bad(msg: str):
            nonlocal ok
            ok = False
            V.append({"rule": "H13", "where": "fest_week", "detail": f"{req_id}: {msg}"})

        room = ctx.rooms.get(d.get("room_id"))
        day = d.get("day")
        a = d.get("start_period")
        b = d.get("end_period")

        if room is None:
            bad(f"unknown room {d.get('room_id')}")
            continue
        if day not in ctx.days or not isinstance(a, int) or not isinstance(b, int) or a < 1 or b > MAX_PERIOD or b < a:
            bad(f"invalid time {day} P{a}-P{b}")
            continue
        if b - a + 1 != req.duration_periods:
            bad(f"booked {b - a + 1} periods, request needs {req.duration_periods}")
        if "event" not in room.allowed_uses:
            bad(f"{room.id} cannot host events")
        if room.type not in req.room_types:
            bad(f"{room.id} ({room.type}) is not one of {req.room_types}")
        if room.capacity < req.attendance:
            bad(f"{room.id} seats {room.capacity}, request needs {req.attendance}")
        feats = set(room.features) | ({"accessible"} if room.accessible else set())
        miss = set(req.needs) - feats
        if miss:
            bad(f"{room.id} lacks {sorted(miss)}")
        if st == "approved":
            inside = any(
                w.get("day") == day and w.get("from_period", 0) <= a and b <= w.get("to_period", 0)
                for w in req.windows
            )
            if not inside:
                bad(f"approved at {day} P{a}-P{b}, outside the requested windows (use alternative_offered)")
        for p in range(a, b + 1):
            if (day, p) in ctx.room_unavailability.get(room.id, set()):
                bad(f"{room.id} unavailable {day} P{p}")
            if room_busy[(room.id, day, p)]:
                bad(f"{room.id} {day} P{p} already used by {', '.join(room_busy[(room.id, day, p)])}")
            for g in req.mandatory_for_groups:
                if wgrp.get((g, day, p)):
                    bad(f"mandatory for {g}, who have class {day} P{p}")
        if ok:
            for p in range(a, b + 1):
                room_busy[(room.id, day, p)].append(req_id)
            placed[req_id] = (room.id, day, a, b)
            score += CAT_WEIGHT[effective_category(ctx, req)] * (1 if st == "approved" else 0.5)

    # Priority inversion check: a rejected request that could have taken a slot given to a lower-priority request
    inversions = []
    for req_id, req in ctx.booking_requests.items():
        d = dec_by.get(req_id)
        if req_id in ctx.cancellations or not d or d.get("status") != "rejected":
            continue
        for other_id, (rid, day, a, b) in placed.items():
            other = ctx.booking_requests[other_id]
            if dec_by[other_id].get("status") != "approved" or not outranks(ctx, req, other):
                continue
            room = ctx.rooms[rid]
            feats = set(room.features) | ({"accessible"} if room.accessible else set())
            if room.type not in req.room_types or room.capacity < req.attendance or set(req.needs) - feats:
                continue
            for w in req.windows:
                if w.get("day") != day:
                    continue
                for s0 in range(w.get("from_period", 1), w.get("to_period", MAX_PERIOD) - req.duration_periods + 2):
                    per = range(s0, s0 + req.duration_periods)
                    if per[-1] > MAX_PERIOD or not any(a <= p <= b for p in per):
                        continue
                    clash = False
                    for p in per:
                        if (day, p) in ctx.room_unavailability.get(rid, set()):
                            clash = True
                        if [x for x in room_busy[(rid, day, p)] if x != other_id]:
                            clash = True
                        for g in req.mandatory_for_groups:
                            if wgrp.get((g, day, p)):
                                clash = True
                    if not clash:
                        inversions.append(
                            f"{req_id} rejected, but {other_id} (lower priority) holds {rid} {day} P{a}-P{b} that {req_id} could use"
                        )
                        break
                else:
                    continue
                break

    stats = {
        "booking_score": score,
        "booking_score_max_if_all_approved": max_score,
        "approved": sum(1 for x in decisions if x.get("status") == "approved"),
        "alternatives": sum(1 for x in decisions if x.get("status") == "alternative_offered"),
        "rejected": sum(1 for x in decisions if x.get("status") == "rejected"),
        "session_overrides": len(overrides),
        "priority_inversions": inversions
    }
    return V, W, stats

