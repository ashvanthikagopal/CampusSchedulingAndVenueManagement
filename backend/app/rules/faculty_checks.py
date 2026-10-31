"""
Faculty Timetable Constraints & Candidate Move Validator.
Pure-Python, deterministic rules engine for all faculty reschedule and move proposals.
Enforces H1-H12, H14, Fest Bookings, Bounds, and Actor Ownership.
Zero LLM, zero network calls.
"""
from typing import Dict, List, Tuple, Set, Any, Optional
from collections import defaultdict
from backend.app.rules.models import DatasetContext, Session, LAST_TEACHING
from backend.app.rules.timetable import block, compute_soft_penalties


def _get_actor_info(actor: Any) -> Tuple[Optional[str], Optional[str]]:
    """Extracts (role, faculty_id) from User model, dict, or object."""
    if actor is None:
        return None, None
    if isinstance(actor, dict):
        return actor.get("role"), actor.get("faculty_id") or actor.get("id")
    role = getattr(actor, "role", None)
    fid = getattr(actor, "faculty_id", None) or getattr(actor, "id", None)
    return role, fid


def _get_booking_periods(b: Any) -> Tuple[str, List[int], str, List[str]]:
    """
    Extracts (day, periods_list, room_id, mandatory_groups) from a booking object or dict.
    """
    if isinstance(b, dict):
        status = b.get("status")
        day = b.get("assigned_day") or b.get("day")
        start = b.get("start_period")
        end = b.get("end_period")
        dur = b.get("duration_periods") or (end - start + 1 if end and start else 1)
        rid = b.get("assigned_room") or b.get("room_id")
        groups = b.get("mandatory_for_groups") or []
        title = b.get("title") or b.get("id") or "Booking"
    else:
        status = getattr(b, "status", None)
        day = getattr(b, "assigned_day", None) or getattr(b, "day", None)
        start = getattr(b, "start_period", None)
        end = getattr(b, "end_period", None)
        dur = getattr(b, "duration_periods", None) or (end - start + 1 if end and start else 1)
        rid = getattr(b, "assigned_room", None) or getattr(b, "room_id", None)
        groups = getattr(b, "mandatory_for_groups", None) or []
        title = getattr(b, "title", None) or getattr(b, "id", None) or "Booking"

    if status != "approved" or not day or not start or not rid:
        return "", [], "", []

    end_p = end if end else (start + dur - 1)
    pers = list(range(start, end_p + 1))
    return day, pers, rid, groups


def check_candidate_move(
    ctx: DatasetContext,
    current_assign: Dict[str, Tuple[str, int, str]],
    session_id: str,
    day: str,
    start: int,
    room_id: str,
    bookings: Optional[List[Any]] = None,
    actor: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Simulates placing ONE session at (day, start, room_id) on top of current_assign.
    Returns ALL violated rules (hard_violations), soft penalty delta, and soft breakdown.
    Does NOT short-circuit on the first violation.
    """
    hard_violations: List[Dict[str, Any]] = []
    notes: List[str] = []

    s: Optional[Session] = ctx.sessions.get(session_id)
    if s is None:
        return {
            "ok": False,
            "hard_violations": [{
                "code": "H1",
                "rule": "Unknown Session",
                "detail": f"Session '{session_id}' not found in dataset context",
                "resources": [session_id]
            }],
            "soft_penalty_delta": 0,
            "soft_breakdown": {k: 0 for k in ("S1", "S2", "S3", "S4", "S5", "S6")},
            "notes": ["Session not found"]
        }

    # Actor Ownership Check
    actor_role, actor_fid = _get_actor_info(actor)
    if actor_role == "faculty" and actor_fid and s.faculty_id != actor_fid:
        hard_violations.append({
            "code": "AUTH_NOT_OWNER",
            "rule": "Session Ownership",
            "detail": f"Faculty {actor_fid} cannot act on session {session_id} belonging to {s.faculty_id}",
            "resources": [session_id, actor_fid, s.faculty_id]
        })

    # Fixed Slot Check (H14)
    fx = s.fixed_slot
    if fx:
        fixed_day = fx.get("day")
        fixed_start = fx.get("start_period")
        if fixed_day != day or fixed_start != start:
            hard_violations.append({
                "code": "H14",
                "rule": "Fixed Slot",
                "detail": f"Session {session_id} is fixed at {fixed_day} P{fixed_start} and cannot be moved to {day} P{start}",
                "resources": [session_id]
            })

    # Day Validity (H1)
    if day not in ctx.days:
        hard_violations.append({
            "code": "H1",
            "rule": "Invalid Day",
            "detail": f"Day '{day}' is not in valid teaching days {ctx.days}",
            "resources": [session_id, day]
        })

    # Period Bounds & Overflow (H9 / Bounds)
    if not isinstance(start, int) or start < 1 or (start + s.duration - 1) > LAST_TEACHING:
        hard_violations.append({
            "code": "H9",
            "rule": "Period Range",
            "detail": f"Start period {start} with duration {s.duration} runs outside valid periods P1-P{LAST_TEACHING}",
            "resources": [session_id]
        })
        periods = []
    else:
        periods = block(start, s.duration)

    # Lunch Break Crossing (H9)
    if periods and periods[0] <= ctx.lunch_after < periods[-1]:
        hard_violations.append({
            "code": "H9",
            "rule": "Lunch Break Crossing",
            "detail": f"Session {session_id} crosses lunch break after P{ctx.lunch_after} ({day} P{periods[0]}-P{periods[-1]})",
            "resources": [session_id]
        })

    # Lab Starting Period Check (H9)
    if s.kind == "lab" and start not in ctx.lab_starts:
        hard_violations.append({
            "code": "H9",
            "rule": "Lab Start Period",
            "detail": f"Lab session {session_id} must start at P2 or P6 (proposed P{start})",
            "resources": [session_id]
        })

    # Room Existence & Validity
    r = ctx.rooms.get(room_id)
    if r is None:
        hard_violations.append({
            "code": "H1",
            "rule": "Unknown Room",
            "detail": f"Room '{room_id}' not found in context",
            "resources": [session_id, room_id]
        })
    else:
        # Room Capacity (H5)
        if r.capacity < s.size:
            hard_violations.append({
                "code": "H5",
                "rule": "Room Capacity",
                "detail": f"Room {room_id} capacity {r.capacity} < session size {s.size}",
                "resources": [session_id, room_id]
            })

        # Room Type Match (H6)
        if r.type not in s.room_types:
            hard_violations.append({
                "code": "H6",
                "rule": "Room Type Match",
                "detail": f"Room {room_id} is of type '{r.type}', but session requires {s.room_types}",
                "resources": [session_id, room_id]
            })

        # Room Accessibility (H10)
        if s.needs_accessible and not r.accessible:
            hard_violations.append({
                "code": "H10",
                "rule": "Room Accessibility",
                "detail": f"Session requires an accessible venue, but room {room_id} is not accessible",
                "resources": [session_id, room_id]
            })

    # Faculty Unavailability (H7)
    fac_unavail = ctx.faculty_unavailability.get(s.faculty_id, set())
    for p in periods:
        if (day, p) in fac_unavail:
            hard_violations.append({
                "code": "H7",
                "rule": "Faculty Unavailability",
                "detail": f"Faculty {s.faculty_id} is marked unavailable on {day} P{p}",
                "resources": [session_id, s.faculty_id, f"{day}_P{p}"]
            })

    # Room Unavailability (H8)
    room_unavail = ctx.room_unavailability.get(room_id, set())
    for p in periods:
        if (day, p) in room_unavail:
            hard_violations.append({
                "code": "H8",
                "rule": "Room Unavailability",
                "detail": f"Room {room_id} is unavailable (maintenance/reserved) on {day} P{p}",
                "resources": [session_id, room_id, f"{day}_P{p}"]
            })

    # Overlaps with other sessions in current_assign
    # Build current session occupancy excluding session_id
    faculty_occupied: Dict[Tuple[str, int], str] = {}
    room_occupied: Dict[Tuple[str, int], str] = {}
    group_occupied: Dict[Tuple[str, str, int], Tuple[str, Optional[str]]] = {}
    faculty_day_hours = defaultdict(int)

    for other_sid, (o_day, o_start, o_rid) in current_assign.items():
        if other_sid == session_id:
            continue
        other_s = ctx.sessions.get(other_sid)
        if not other_s:
            continue
        o_pers = block(o_start, other_s.duration)
        faculty_day_hours[(other_s.faculty_id, o_day)] += other_s.duration

        for p in o_pers:
            room_occupied[(o_rid, o_day, p)] = other_sid
            faculty_occupied[(other_s.faculty_id, o_day, p)] = other_sid
            for g in other_s.groups:
                group_occupied[(g, o_day, p)] = (other_sid, other_s.basket_slot)

    # Faculty Clash (H2)
    for p in periods:
        clash_sid = faculty_occupied.get((s.faculty_id, day, p))
        if clash_sid:
            hard_violations.append({
                "code": "H2",
                "rule": "Faculty Clash",
                "detail": f"Faculty {s.faculty_id} is already teaching session {clash_sid} on {day} P{p}",
                "resources": [session_id, clash_sid, s.faculty_id]
            })

    # Room Clash (H4)
    for p in periods:
        clash_sid = room_occupied.get((room_id, day, p))
        if clash_sid:
            hard_violations.append({
                "code": "H4",
                "rule": "Room Clash",
                "detail": f"Room {room_id} is already occupied by session {clash_sid} on {day} P{p}",
                "resources": [session_id, clash_sid, room_id]
            })

    # Student Group Clash (H3)
    # Note: Sessions sharing the same non-empty basket_slot do NOT clash with each other
    for p in periods:
        for g in s.groups:
            clash_info = group_occupied.get((g, day, p))
            if clash_info:
                clash_sid, clash_basket = clash_info
                # Basket exemption: same basket_slot does not clash
                if s.basket_slot and clash_basket and s.basket_slot == clash_basket:
                    continue
                hard_violations.append({
                    "code": "H3",
                    "rule": "Group Clash",
                    "detail": f"Student group {g} is already scheduled for session {clash_sid} on {day} P{p}",
                    "resources": [session_id, clash_sid, g]
                })

    # Faculty Max Hours Per Day (H12)
    fac_obj = ctx.faculty.get(s.faculty_id)
    max_h = fac_obj.max_hours_per_day if fac_obj else 4
    projected_h = faculty_day_hours[(s.faculty_id, day)] + s.duration
    if projected_h > max_h:
        hard_violations.append({
            "code": "H12",
            "rule": "Faculty Daily Limit",
            "detail": f"Faculty {s.faculty_id} would teach {projected_h} hours on {day} (limit is {max_h} hrs/day)",
            "resources": [session_id, s.faculty_id, day]
        })

    # Elective Basket Synchronicity (H11)
    if s.basket_slot:
        # Check if other sessions in the same basket are at (day, start)
        for sib_sid, sib_s in ctx.sessions.items():
            if sib_sid != session_id and sib_s.basket_slot == s.basket_slot:
                sib_slot = current_assign.get(sib_sid)
                if sib_slot:
                    sib_day, sib_start, _ = sib_slot
                    if (sib_day, sib_start) != (day, start):
                        hard_violations.append({
                            "code": "H11",
                            "rule": "Elective Basket Sync",
                            "detail": f"Basket '{s.basket_slot}' requires all elective tracks at identical day/time. Sibling {sib_sid} is at {sib_day} P{sib_start}",
                            "resources": [session_id, sib_sid, s.basket_slot]
                        })

    # Approved Fest Bookings & Mandatory Event Clashes
    if bookings:
        for b in bookings:
            b_day, b_pers, b_rid, b_groups = _get_booking_periods(b)
            if not b_day or b_day != day:
                continue

            # Overlap check
            overlap_pers = [p for p in periods if p in b_pers]
            if not overlap_pers:
                continue

            # 1. Room overlap
            if b_rid == room_id:
                hard_violations.append({
                    "code": "BOOKING_ROOM_CLASH",
                    "rule": "Approved Venue Booking",
                    "detail": f"Room {room_id} has an approved event booking on {day} P{overlap_pers[0]}",
                    "resources": [session_id, room_id]
                })

            # 2. Mandatory attendee group overlap
            if b_groups:
                clashing_groups = [g for g in s.groups if g in b_groups]
                for cg in clashing_groups:
                    hard_violations.append({
                        "code": "BOOKING_GROUP_CLASH",
                        "rule": "Mandatory Event Attendee",
                        "detail": f"Student group {cg} is required to attend approved event on {day} P{overlap_pers[0]}",
                        "resources": [session_id, cg]
                    })

    # Calculate Soft Penalties & Breakdown
    # Simulate move in assignment dictionary
    sim_assign = dict(current_assign)
    sim_assign[session_id] = (day, start, room_id)

    cur_soft_map, cur_total_soft = compute_soft_penalties(ctx, current_assign)
    sim_soft_map, sim_total_soft = compute_soft_penalties(ctx, sim_assign)

    soft_delta = sim_total_soft - cur_total_soft
    soft_breakdown = {k: sim_soft_map.get(k, 0) - cur_soft_map.get(k, 0) for k in ("S1", "S2", "S3", "S4", "S5", "S6")}

    # Faculty avoid note
    if fac_obj:
        for pref in fac_obj.preferences:
            if pref.get("type") == "avoid" and day in pref.get("days", ctx.days):
                clash_avoid = [p for p in periods if p in pref.get("periods", [])]
                if clash_avoid:
                    notes.append(f"Faculty prefers to avoid {day} P{clash_avoid} ({pref.get('note', '')})")

    is_ok = len(hard_violations) == 0

    return {
        "ok": is_ok,
        "hard_violations": hard_violations,
        "soft_penalty_delta": soft_delta,
        "soft_breakdown": soft_breakdown,
        "notes": notes
    }


def enumerate_legal_options(
    ctx: DatasetContext,
    current_assign: Dict[str, Tuple[str, int, str]],
    session_id: str,
    bookings: Optional[List[Any]] = None,
    limit: int = 3,
    filters: Optional[Dict[str, Any]] = None,
    actor: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """
    Exhaustively scans the timetable grid and returns the top-N zero-violation candidate slots.
    Ranked deterministically by (soft_penalty_delta, day_order, start_period, room_id).
    """
    s = ctx.sessions.get(session_id)
    if not s:
        return []

    # If session is fixed_slot, only the fixed slot could ever be legal
    if s.fixed_slot:
        fx = s.fixed_slot
        candidate_days = [fx.get("day")]
        candidate_starts = [fx.get("start_period")]
    else:
        candidate_days = ctx.days
        candidate_starts = list(range(1, LAST_TEACHING - s.duration + 2))

    # Apply optional day/period filters
    if filters:
        if "day" in filters and filters["day"]:
            candidate_days = [filters["day"]] if filters["day"] in candidate_days else []
        elif "preferred_days" in filters and filters["preferred_days"]:
            candidate_days = [d for d in filters["preferred_days"] if d in candidate_days]
        if "start_period" in filters and filters["start_period"] in candidate_starts:
            candidate_starts = [filters["start_period"]]

    day_rank = {d: i for i, d in enumerate(ctx.days)}
    legal_candidates = []

    # Pre-filter rooms by static requirements
    candidate_rooms = []
    for rid, r in ctx.rooms.items():
        if filters and "room_id" in filters and filters["room_id"] != rid:
            continue
        if r.type not in s.room_types:
            continue
        if r.capacity < s.size:
            continue
        if s.needs_accessible and not r.accessible:
            continue
        candidate_rooms.append(rid)

    # Sort rooms for deterministic tie-breaking
    candidate_rooms.sort()

    for day in candidate_days:
        for start in candidate_starts:
            # Quick lunch check
            if start <= ctx.lunch_after < (start + s.duration - 1):
                continue
            # Quick lab start check
            if s.kind == "lab" and start not in ctx.lab_starts:
                continue

            for rid in candidate_rooms:
                result = check_candidate_move(
                    ctx=ctx,
                    current_assign=current_assign,
                    session_id=session_id,
                    day=day,
                    start=start,
                    room_id=rid,
                    bookings=bookings,
                    actor=actor
                )

                if result["ok"]:
                    r_obj = ctx.rooms[rid]
                    legal_candidates.append({
                        "day": day,
                        "start_period": start,
                        "end_period": start + s.duration - 1,
                        "room_id": rid,
                        "room_name": getattr(r_obj, "name", rid),
                        "room_type": r_obj.type,
                        "capacity": r_obj.capacity,
                        "soft_penalty_delta": result["soft_penalty_delta"],
                        "soft_breakdown": result["soft_breakdown"],
                        "hard_violations_count": 0,
                        "checked_rules": [
                            "H1_Once", "H2_FacultyClash", "H3_GroupClash", "H4_RoomClash",
                            "H5_Capacity", "H6_RoomType", "H7_FacultyUnavail", "H8_RoomUnavail",
                            "H9_Lunch_LabStart", "H10_Accessibility", "H11_BasketSync",
                            "H12_DailyLimit", "H14_FixedSlot", "ApprovedBookings"
                        ],
                        "notes": result["notes"]
                    })

    # Deterministic multi-key sort:
    # 1. Soft penalty delta (lower is better)
    # 2. Day index (MON -> FRI)
    # 3. Start period (P1 -> P9)
    # 4. Room ID lexicographical
    legal_candidates.sort(
        key=lambda c: (
            c["soft_penalty_delta"],
            day_rank.get(c["day"], 99),
            c["start_period"],
            c["room_id"]
        )
    )

    return legal_candidates[:limit]


def explain_infeasible(
    ctx: DatasetContext,
    current_assign: Dict[str, Tuple[str, int, str]],
    session_id: str,
    bookings: Optional[List[Any]] = None,
    actor: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Analyzes why NO direct single move is legal for session_id.
    Aggregates bottleneck failure counts across the entire grid and provides
    clear, actionable diagnostic guidance.
    """
    s = ctx.sessions.get(session_id)
    if not s:
        return {
            "session_id": session_id,
            "status": "UNKNOWN_SESSION",
            "bottlenecks": ["Session does not exist in dataset context."],
            "suggestions": []
        }

    if s.fixed_slot:
        fx = s.fixed_slot
        return {
            "session_id": session_id,
            "status": "FIXED_SLOT_IMMUTABLE",
            "bottlenecks": [
                f"Session {session_id} is designated as fixed at {fx.get('day')} P{fx.get('start_period')} (Rule H14) and cannot be moved."
            ],
            "suggestions": [
                "Fixed slots can only be modified with administrative override."
            ]
        }

    fail_counts = defaultdict(int)
    clashing_entities = defaultdict(set)
    total_probed = 0

    candidate_starts = list(range(1, LAST_TEACHING - s.duration + 2))
    candidate_rooms = [
        rid for rid, r in ctx.rooms.items()
        if r.type in s.room_types and r.capacity >= s.size
    ]

    for day in ctx.days:
        for start in candidate_starts:
            for rid in candidate_rooms:
                total_probed += 1
                res = check_candidate_move(
                    ctx=ctx,
                    current_assign=current_assign,
                    session_id=session_id,
                    day=day,
                    start=start,
                    room_id=rid,
                    bookings=bookings,
                    actor=actor
                )
                for hv in res["hard_violations"]:
                    code = hv["code"]
                    fail_counts[code] += 1
                    for rsrc in hv.get("resources", []):
                        clashing_entities[code].add(str(rsrc))

    bottlenecks: List[str] = []
    suggestions: List[str] = []

    if fail_counts["H12"] > 0:
        fac = ctx.faculty.get(s.faculty_id)
        mx = fac.max_hours_per_day if fac else 4
        bottlenecks.append(
            f"Faculty {s.faculty_id} reaches daily teaching limit ({mx}h) on {fail_counts['H12']} slot combinations."
        )
        suggestions.append("Consider swapping or reducing teaching hours on busy days before adding or moving sessions.")

    if fail_counts["H3"] > 0:
        bottlenecks.append(
            f"Student groups {s.groups} have preexisting lectures or labs blocking {fail_counts['H3']} candidate slots."
        )

    if fail_counts["H4"] > 0 or fail_counts["BOOKING_ROOM_CLASH"] > 0:
        bottlenecks.append(
            f"Compatible venues are congested ({fail_counts['H4']} timetable collisions, {fail_counts['BOOKING_ROOM_CLASH']} approved venue events)."
        )

    if fail_counts["H11"] > 0:
        bottlenecks.append(
            f"Elective basket synchronicity (Rule H11) restricts moving session '{session_id}' individually without moving sibling tracks in basket '{s.basket_slot}'."
        )
        suggestions.append(f"Move all companion courses in elective basket '{s.basket_slot}' concurrently via CP-SAT Multi-Session Repair.")

    if not bottlenecks:
        bottlenecks.append("All candidate slots violate one or more timetable constraints.")

    suggestions.append("Use the automated CP-SAT Repair Engine to compute ripple moves for other sessions.")

    return {
        "session_id": session_id,
        "status": "INFEASIBLE_SINGLE_MOVE",
        "probed_combinations": total_probed,
        "bottlenecks": bottlenecks,
        "suggestions": suggestions,
        "violation_frequency": dict(fail_counts)
    }
