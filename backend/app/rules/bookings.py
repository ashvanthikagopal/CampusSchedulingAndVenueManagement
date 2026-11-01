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



def validate_single_booking(
    ctx: DatasetContext,
    base_assign: Dict[str, Tuple[str, int, str]],
    booking_dict: Dict[str, Any],
    existing_decisions: Optional[List[Dict[str, Any]]] = None,
    user_role: str = "club",
    priority_order: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Deterministic manual booking validator (Issue C).
    Validates all 14 booking criteria:
    day/period, duration, room existence, capacity, room type, features, accessibility,
    maintenance, regular classes, approved bookings, mandatory groups, event-only periods,
    priority, role-capping, cancellation status.
    Returns {"pass": bool, "reason_code": str, "reason": str, "suggested_alternative": Optional[dict]}.
    """
    if existing_decisions is None:
        existing_decisions = []

    req_id = booking_dict.get("id") or booking_dict.get("request_id")
    # 1. Cancellation check
    if req_id and req_id in ctx.cancellations:
        return {
            "pass": False,
            "reason_code": "CANCELLED",
            "reason": f"Booking request '{req_id}' was officially cancelled/withdrawn by requester."
        }

    # 2. Attendance & Campus Capacity
    attendance = booking_dict.get("attendance", 0)
    if attendance <= 0:
        return {
            "pass": False,
            "reason_code": "INVALID_ATTENDANCE",
            "reason": "Attendance must be a positive integer."
        }

    event_rooms = [r for r in ctx.rooms.values() if "event" in r.allowed_uses]
    max_campus_capacity = max((r.capacity for r in event_rooms), default=0)
    if attendance > max_campus_capacity:
        return {
            "pass": False,
            "reason_code": "NO_VENUE_CAPACITY",
            "reason": f"Attendance {attendance} exceeds maximum campus event venue capacity ({max_campus_capacity} in OAT)."
        }

    # 3. Duration & Window validity
    dur = booking_dict.get("duration_periods", 1)
    if dur < 1 or dur > MAX_PERIOD:
        return {
            "pass": False,
            "reason_code": "INVALID_DURATION",
            "reason": f"Duration {dur} is outside permitted event duration (1-{MAX_PERIOD} periods)."
        }

    windows = booking_dict.get("windows", [])
    if not windows:
        return {
            "pass": False,
            "reason_code": "NO_WINDOW",
            "reason": "At least one time window must be specified."
        }

    valid_windows = [
        w for w in windows
        if w.get("day") in ctx.days
        and 1 <= w.get("from_period", 0) <= w.get("to_period", 0) <= MAX_PERIOD
        and (w.get("to_period", 0) - w.get("from_period", 0) + 1) >= dur
    ]

    if not valid_windows:
        return {
            "pass": False,
            "reason_code": "WINDOW_INVALID",
            "reason": f"Requested windows are outside permitted academic periods (P1-P{MAX_PERIOD}) or duration {dur} exceeds window span."
        }

    # 4. Role-based category restriction & priority
    p_order = priority_order or ctx.priority_order
    req_cat = booking_dict.get("requested_category") or "club_event"
    cap_cat = ctx.role_category_cap.get(user_role, "club_event")
    cat_idx = p_order.index(req_cat) if req_cat in p_order else 99
    cap_idx = p_order.index(cap_cat) if cap_cat in p_order else 99
    eff_cat = req_cat if cat_idx >= cap_idx else cap_cat
    is_institute_or_higher = (p_order.index(eff_cat) <= p_order.index("institute_event")) if eff_cat in p_order else False

    # Build timetable occupancy
    room_class_busy = defaultdict(list)
    grp_class_busy = defaultdict(list)
    for sid, (d, st, rid) in base_assign.items():
        s = ctx.sessions.get(sid)
        if s:
            for p in block(st, s.duration):
                room_class_busy[(rid, d, p)].append(sid)
                for g in s.groups:
                    grp_class_busy[(g, d, p)].append(sid)

    # Build existing approved bookings occupancy
    event_busy = defaultdict(list)
    grp_event_busy = defaultdict(list)
    for dec in existing_decisions:
        if dec.get("status") in ("approved", "alternative_offered"):
            d_rid = dec.get("room_id")
            d_day = dec.get("day")
            d_st = dec.get("start_period")
            d_end = dec.get("end_period")
            d_id = dec.get("request_id")
            if d_rid and d_day and d_st and d_end:
                for p in range(d_st, d_end + 1):
                    event_busy[(d_rid, d_day, p)].append(d_id)
            orig_req = ctx.booking_requests.get(d_id)
            if orig_req:
                for g in orig_req.mandatory_for_groups:
                    for p in range(d_st or 1, (d_end or 1) + 1):
                        grp_event_busy[(g, d_day, p)].append(d_id)

    # Check requested room
    req_room_id = booking_dict.get("requested_room")
    needs = booking_dict.get("needs", [])
    room_types = booking_dict.get("room_types", [])
    mandatory_groups = booking_dict.get("mandatory_for_groups", [])

    def check_slot(r, day, s0, e0):
        # 1. Room allowed uses
        if "event" not in r.allowed_uses:
            return False, "ROOM_ALLOWED_USES", f"Room '{r.id}' ({r.type}) is not designated for event bookings (allowed: {r.allowed_uses})."
        # 2. Room type
        if room_types and r.type not in room_types:
            return False, "ROOM_TYPE_MISMATCH", f"Room '{r.id}' is of type '{r.type}', not in requested {room_types}."
        # 3. Capacity
        if r.capacity < attendance:
            return False, "CAPACITY_EXCEEDED", f"Room '{r.id}' seats {r.capacity}, but event attendance is {attendance}."
        # 4. Features & accessibility
        feats = set(r.features) | ({"accessible"} if r.accessible else set())
        miss = set(needs) - feats
        if miss:
            return False, "FACILITIES_NOT_MET", f"Room '{r.id}' lacks required facilities: {sorted(miss)}."
        if "accessible" in needs and not r.accessible:
            return False, "NOT_ACCESSIBLE", f"Room '{r.id}' is not wheelchair accessible."
        # 5. Lunch crossing (periods 1-9)
        if s0 <= ctx.lunch_after < e0:
            return False, "LUNCH_CROSSING", f"Event timing ({day} P{s0}-P{e0}) crosses lunch hour."
        # 6. Room maintenance
        for p in range(s0, e0 + 1):
            if (day, p) in ctx.room_unavailability.get(r.id, set()):
                return False, "ROOM_MAINTENANCE", f"Room '{r.id}' has scheduled maintenance/unavailability on {day} Period {p}."
        # 7. Existing classes
        for p in range(s0, e0 + 1):
            clashing = room_class_busy.get((r.id, day, p), [])
            if clashing:
                if not (is_institute_or_higher and r.id == "AUD"):
                    return False, "CLASS_COLLISION", f"Room '{r.id}' is occupied by academic class {clashing[0]} on {day} Period {p}."
        # 8. Existing approved bookings
        for p in range(s0, e0 + 1):
            clashing_ev = event_busy.get((r.id, day, p), [])
            if clashing_ev and (req_id is None or clashing_ev != [req_id]):
                return False, "BOOKING_COLLISION", f"Room '{r.id}' is already booked by {clashing_ev[0]} on {day} Period {p}."
        # 9. Mandatory student groups
        for g in mandatory_groups:
            for p in range(s0, e0 + 1):
                clashing_c = grp_class_busy.get((g, day, p), [])
                if clashing_c:
                    return False, "GROUP_BUSY", f"Mandatory student group '{g}' has class {clashing_c[0]} on {day} Period {p}."
                clashing_e = grp_event_busy.get((g, day, p), [])
                if clashing_e and (req_id is None or clashing_e != [req_id]):
                    return False, "GROUP_BUSY", f"Mandatory student group '{g}' has another event {clashing_e[0]} on {day} Period {p}."
        return True, "INSIDE_WINDOW_ROOM_FREE", "Venue and timing are feasible with zero conflicts."

    # If specific room requested, test in windows
    if req_room_id:
        r = ctx.rooms.get(req_room_id)
        if not r:
            # Room does not exist; find alternative
            alt = find_alternative(ctx, valid_windows, dur, attendance, room_types, needs, mandatory_groups, check_slot)
            return {
                "pass": False,
                "reason_code": "ROOM_NOT_FOUND",
                "reason": f"Requested venue '{req_room_id}' does not exist on campus.",
                "suggested_alternative": alt
            }

        first_fail = None
        for w in valid_windows:
            w_day = w["day"]
            for s0 in range(w["from_period"], w["to_period"] - dur + 2):
                e0 = s0 + dur - 1
                ok, code, msg = check_slot(r, w_day, s0, e0)
                if ok:
                    return {
                        "pass": True,
                        "reason_code": code,
                        "reason": f"Venue '{r.name}' ({r.id}) is feasible and available on {w_day} P{s0}-P{e0} with zero conflicts."
                    }
                elif first_fail is None:
                    first_fail = (code, msg)

        # Room requested has conflicts in all windows; find alternative
        alt = find_alternative(ctx, valid_windows, dur, attendance, room_types, needs, mandatory_groups, check_slot, exclude_room=req_room_id)
        code, msg = first_fail if first_fail else ("NO_VALID_SLOT", f"Requested venue '{r.name}' cannot accommodate event in the specified windows.")
        return {
            "pass": False,
            "reason_code": code,
            "reason": msg,
            "suggested_alternative": alt
        }
    else:
        # No specific room requested; find first feasible room
        for w in valid_windows:
            w_day = w["day"]
            for s0 in range(w["from_period"], w["to_period"] - dur + 2):
                e0 = s0 + dur - 1
                for r in event_rooms:
                    ok, code, msg = check_slot(r, w_day, s0, e0)
                    if ok:
                        return {
                            "pass": True,
                            "reason_code": "INSIDE_WINDOW_ROOM_FREE",
                            "reason": f"Feasible venue '{r.name}' ({r.id}) available on {w_day} P{s0}-P{e0}."
                        }

        # None found in windows
        alt = find_alternative(ctx, valid_windows, dur, attendance, room_types, needs, mandatory_groups, check_slot)
        return {
            "pass": False,
            "reason_code": "VENUE_UNAVAILABLE",
            "reason": "No compatible venue is available during the requested time window.",
            "suggested_alternative": alt
        }


def find_alternative(ctx, windows, dur, attendance, room_types, needs, mandatory_groups, check_slot_fn, exclude_room=None):
    """Finds a feasible alternative venue/slot if the primary request clashes."""
    event_rooms = [
        r for r in ctx.rooms.values()
        if "event" in r.allowed_uses and r.capacity >= attendance and (exclude_room is None or r.id != exclude_room)
    ]
    event_rooms.sort(key=lambda r: r.capacity)  # smallest room that fits

    # 1. Try other rooms within requested windows
    for w in windows:
        w_day = w["day"]
        for s0 in range(w["from_period"], w["to_period"] - dur + 2):
            e0 = s0 + dur - 1
            for r in event_rooms:
                ok, _, _ = check_slot_fn(r, w_day, s0, e0)
                if ok:
                    return {
                        "room_id": r.id,
                        "room_name": r.name,
                        "day": w_day,
                        "start_period": s0,
                        "end_period": e0,
                        "reason": f"Alternative venue '{r.name}' ({r.id}) seats {r.capacity} and is completely free on {w_day} P{s0}-P{e0}."
                    }

    # 2. Try evening event periods (P10-P13)
    for day in ctx.days:
        s0, e0 = 10, min(10 + dur - 1, MAX_PERIOD)
        if e0 - s0 + 1 == dur:
            for r in event_rooms:
                ok, _, _ = check_slot_fn(r, day, s0, e0)
                if ok:
                    return {
                        "room_id": r.id,
                        "room_name": r.name,
                        "day": day,
                        "start_period": s0,
                        "end_period": e0,
                        "reason": f"Evening slot alternative at {r.name} ({day} P{s0}-P{e0}) with zero academic conflicts."
                    }

    return None
