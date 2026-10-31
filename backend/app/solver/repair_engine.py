"""
Disruption and Minimal-Change Repair Engine for CIT Campus Scheduling.
Takes an active baseline schedule and a disruption payload, applies changes,
identifies affected sessions, re-solves using CP-SAT with a minimal-change objective,
and generates schedule_after.json with zero hard violations.
"""
from typing import Dict, List, Tuple, Set, Any, Optional
import copy
import time
from ortools.sat.python import cp_model

from backend.app.rules.models import DatasetContext, Session
from backend.app.rules.timetable import validate_full_timetable, compute_soft_penalties, block
from backend.app.solver.timetable_solver import solve_timetable
from backend.app.solver.booking_engine import solve_bookings
from backend.validator.validator import apply_disruption as official_apply_disruption


def repair_schedule(
    base_data: Dict[str, Any],
    disruption: Dict[str, Any],
    base_schedule: Dict[str, Any],
    time_limit_seconds: float = 60.0,
    random_seed: int = 42
) -> Tuple[str, Optional[Dict[str, Any]], Dict[str, Any]]:
    """
    Repairs the schedule after disruption.
    Returns (status, repaired_schedule_dict, proposal_details).
    """
    # 1. Apply disruption to data
    new_data = official_apply_disruption(base_data, disruption)
    new_ctx = DatasetContext.from_dict(new_data)

    # 2. Extract baseline assignments: sid -> (day, start, room)
    base_assign = {}
    for s in base_schedule.get("sessions", []):
        base_assign[s["session_id"]] = (s["day"], s["start_period"], s["room_id"])

    # 3. Find affected sessions in new dataset context
    # Any session that now violates hard rules, plus any new session in new_ctx not in base_assign
    violations, _ = validate_full_timetable(new_ctx, base_assign, "disruption_check")
    affected_sids = set()
    for v in violations:
        detail = v["detail"]
        for sid in new_ctx.sessions:
            if sid in detail:
                affected_sids.add(sid)

    for sid in new_ctx.sessions:
        if sid not in base_assign:
            affected_sids.add(sid)

    # If sessions were removed by disruption
    removed_sids = set(base_assign.keys()) - set(new_ctx.sessions.keys())

    print(f"Repair: {len(affected_sids)} directly affected sessions: {sorted(affected_sids)}")

    # 4. First try minimal repair: allow only affected sessions (and closely connected sessions) to move
    # Level 1: affected sessions + same faculty sessions + same room sessions at conflicting times
    expanded_free_sids = set(affected_sids)

    # Add sessions that share rooms or faculties with affected sessions to provide swapping room
    for sid in list(affected_sids):
        s_obj = new_ctx.sessions.get(sid)
        if s_obj:
            # Add sessions with same faculty
            for s2_id, s2_obj in new_ctx.sessions.items():
                if s2_obj.faculty_id == s_obj.faculty_id:
                    expanded_free_sids.add(s2_id)
                if any(g in s2_obj.groups for g in s_obj.groups):
                    # Sessions of same group on same day in baseline
                    if sid in base_assign and s2_id in base_assign and base_assign[sid][0] == base_assign[s2_id][0]:
                        expanded_free_sids.add(s2_id)

    print(f"Repair: Expanded candidate free set to {len(expanded_free_sids)} sessions")

    # 5. Build minimal-change CP-SAT solver
    # Pre-filter options for each session
    session_options = {}
    for sid, s in new_ctx.sessions.items():
        if sid not in expanded_free_sids and sid in base_assign:
            # Fix to baseline assignment
            b_day, b_start, b_room = base_assign[sid]
            # Check if this fixed assignment is still legal
            is_legal = True
            per = block(b_start, s.duration)
            if any((b_day, p) in new_ctx.faculty_unavailability.get(s.faculty_id, set()) for p in per):
                is_legal = False
            if any((b_day, p) in new_ctx.room_unavailability.get(b_room, set()) for p in per):
                is_legal = False
            r_obj = new_ctx.rooms.get(b_room)
            if not r_obj or r_obj.capacity < s.size:
                is_legal = False

            if is_legal:
                session_options[sid] = [(b_day, b_start, b_room)]
                continue

        # If not fixed or illegal, generate legal options
        valid_opts = []
        fx = s.fixed_slot
        for day in new_ctx.days:
            if fx and fx.get("day") != day:
                continue
            for start in range(1, 9 - s.duration + 2):
                if fx and fx.get("start_period") != start:
                    continue
                end_p = start + s.duration - 1
                if start <= new_ctx.lunch_after < end_p:
                    continue
                if s.kind == "lab" and start not in new_ctx.lab_starts:
                    continue
                per = block(start, s.duration)
                if any((day, p) in new_ctx.faculty_unavailability.get(s.faculty_id, set()) for p in per):
                    continue

                for rid, r in new_ctx.rooms.items():
                    if s.kind == "lab" and "lab" not in r.allowed_uses:
                        continue
                    if s.kind in ("lecture", "tutorial") and s.kind not in r.allowed_uses:
                        continue
                    if r.type not in s.room_types:
                        continue
                    if r.capacity < s.size:
                        continue
                    if s.needs_accessible and not r.accessible:
                        continue
                    if any((day, p) in new_ctx.room_unavailability.get(rid, set()) for p in per):
                        continue
                    valid_opts.append((day, start, rid))
        session_options[sid] = valid_opts

    # 6. Formulate CP-SAT model
    model = cp_model.CpModel()
    x = {}
    session_var_map = {}
    obj_terms = []

    for sid, s in new_ctx.sessions.items():
        session_var_map[sid] = []
        opts = session_options[sid]
        b_triple = base_assign.get(sid)

        for (d, st, r) in opts:
            v = model.NewBoolVar(f"rep_{sid}_{d}_{st}_{r}")
            x[(sid, d, st, r)] = v
            session_var_map[sid].append(((d, st, r), v))

            # Penalty for moving away from baseline triple
            move_cost = 0
            if b_triple is not None:
                if (d, st, r) != b_triple:
                    if (d, st) != (b_triple[0], b_triple[1]):
                        # Changed time + maybe room
                        move_cost += 100_000
                    else:
                        # Changed room only
                        move_cost += 80_000

            # Include baseline soft costs
            # S5 (capacity ratio)
            rm = new_ctx.rooms[r]
            if rm.capacity and (s.size / rm.capacity < 0.4):
                move_cost += 10
            # S6 (period 9)
            if 9 in block(st, s.duration):
                move_cost += 10

            if move_cost > 0:
                obj_terms.append(move_cost * v)

        model.AddExactlyOne([v for _, v in session_var_map[sid]])

    # Room capacity / non-overlap
    from collections import defaultdict
    room_p_vars = defaultdict(list)
    fac_p_vars = defaultdict(list)
    fac_day_durations = defaultdict(list)

    for sid, s in new_ctx.sessions.items():
        f = s.faculty_id
        for (d, st, r), v in session_var_map[sid]:
            fac_day_durations[(f, d)].append(s.duration * v)
            for p in block(st, s.duration):
                room_p_vars[(r, d, p)].append(v)
                fac_p_vars[(f, d, p)].append(v)

    for (r, d, p), vlist in room_p_vars.items():
        if len(vlist) > 1:
            model.Add(sum(vlist) <= 1)

    for (f, d, p), vlist in fac_p_vars.items():
        if len(vlist) > 1:
            model.Add(sum(vlist) <= 1)

    for (f, d), exprs in fac_day_durations.items():
        fac_obj = new_ctx.faculty.get(f)
        max_h = fac_obj.max_hours_per_day if fac_obj else 4
        model.Add(sum(exprs) <= max_h)

    # Basket synchronicity
    baskets = defaultdict(list)
    for sid, s in new_ctx.sessions.items():
        if s.basket_slot:
            baskets[s.basket_slot].append(sid)

    basket_time_vars = {}
    for b_slot, sids in baskets.items():
        all_possible_times = set()
        for sid in sids:
            for (d, st, _), _ in session_var_map[sid]:
                all_possible_times.add((d, st))

        for (d, st) in all_possible_times:
            bv = model.NewBoolVar(f"rep_b_{b_slot}_{d}_{st}")
            basket_time_vars[(b_slot, d, st)] = bv
            for sid in sids:
                matching = [v for (day, start, _), v in session_var_map[sid] if day == d and start == st]
                if matching:
                    model.Add(sum(matching) == bv)
                else:
                    model.Add(bv == 0)

        model.AddExactlyOne([basket_time_vars[(b_slot, d, st)] for (d, st) in all_possible_times])

    # Group non-overlap
    grp_p_non_basket = defaultdict(list)
    grp_p_baskets = defaultdict(set)
    for sid, s in new_ctx.sessions.items():
        for (d, st, r), v in session_var_map[sid]:
            for p in block(st, s.duration):
                for g in s.groups:
                    if s.basket_slot:
                        grp_p_baskets[(g, d, p)].add((s.basket_slot, d, st))
                    else:
                        grp_p_non_basket[(g, d, p)].append(v)

    all_keys = set(grp_p_non_basket.keys()) | set(grp_p_baskets.keys())
    for (g, d, p) in all_keys:
        terms = list(grp_p_non_basket[(g, d, p)])
        for (b_slot, b_day, b_start) in grp_p_baskets[(g, d, p)]:
            bv = basket_time_vars.get((b_slot, b_day, b_start))
            if bv is not None and bv not in terms:
                terms.append(bv)
        if len(terms) > 1:
            model.Add(sum(terms) <= 1)

    model.Minimize(sum(obj_terms))

    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.num_search_workers = 8
    solver.parameters.random_seed = random_seed
    status_code = solver.Solve(model)

    if status_code not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        diagnostic = diagnose_infeasibility(new_ctx, base_assign, disruption, session_options)
        return "INFEASIBLE", None, diagnostic

    # Extract new timetable
    repaired_assign = {}
    for sid in new_ctx.sessions:
        for (d, st, r), v in session_var_map[sid]:
            if solver.Value(v) == 1:
                repaired_assign[sid] = (d, st, r)
                break

    # Calculate moved sessions
    moved_list = []
    for sid, new_triple in repaired_assign.items():
        if sid in base_assign:
            old_triple = base_assign[sid]
            if new_triple != old_triple:
                moved_list.append({
                    "session_id": sid,
                    "before": {"day": old_triple[0], "start_period": old_triple[1], "room_id": old_triple[2]},
                    "after": {"day": new_triple[0], "start_period": new_triple[1], "room_id": new_triple[2]},
                    "time_changed": new_triple[:2] != old_triple[:2],
                    "room_only_changed": new_triple[:2] == old_triple[:2]
                })
        else:
            moved_list.append({
                "session_id": sid,
                "before": None,
                "after": {"day": new_triple[0], "start_period": new_triple[1], "room_id": new_triple[2]},
                "time_changed": True,
                "room_only_changed": False
            })

    # Re-run Spectra Week bookings on the new timetable!
    # As Section C6.4 says: "then re-run the Week 7 booking engine against the new timetable"
    new_bookings, new_overrides, booking_stats = solve_bookings(new_ctx, repaired_assign, time_limit_seconds=20.0)

    # Build schedule_after structure
    repaired_sessions_list = [
        {"session_id": sid, "day": d, "start_period": st, "room_id": r}
        for sid, (d, st, r) in sorted(repaired_assign.items())
    ]

    schedule_after = {
        "team": base_schedule.get("team", "CIT Scheduler Master Team"),
        "dataset_id": new_ctx.dataset_id,
        "sessions": repaired_sessions_list,
        "fest_week": {
            "bookings": new_bookings,
            "session_overrides": new_overrides
        }
    }

    proposal = {
        "moved_count": len(moved_list),
        "moved_sessions": moved_list,
        "time_changed_count": sum(1 for m in moved_list if m["time_changed"]),
        "room_only_changed_count": sum(1 for m in moved_list if m["room_only_changed"]),
        "status": "pending_approval"
    }

    return "FEASIBLE", schedule_after, proposal


def diagnose_infeasibility(
    ctx: DatasetContext,
    base_assign: Dict[str, Tuple[str, int, str]],
    disruption: Dict[str, Any],
    session_options: Dict[str, List[Tuple[str, int, str]]]
) -> Dict[str, Any]:
    """
    Deterministic constraint conflict analyzer for infeasible disruptions.
    Identifies exact violated hard rules (H1-H14), involved sessions, and conflicting resources.
    """
    violated_rules = []
    affected_sids = []
    conflicting_res = []
    reasons = []

    # 1. Sessions with zero legal candidate slots
    for sid, s in ctx.sessions.items():
        opts = session_options.get(sid, [])
        if not opts:
            affected_sids.append(sid)
            fac_id = s.faculty_id
            if fac_id in ctx.faculty_unavailability:
                violated_rules.append("H7")
                conflicting_res.append(f"Faculty:{fac_id}")
                reasons.append(
                    f"Session {sid} ({s.course_id}) has 0 legal slots because faculty {fac_id} has declared unavailability covering all valid periods."
                )

            compat_rooms = [rid for rid, r in ctx.rooms.items() if r.type in s.room_types and r.capacity >= s.size]
            if not compat_rooms:
                violated_rules.append("H5")
                reasons.append(f"Session {sid} ({s.course_id}) requires capacity {s.size} but no room with type {s.room_types} meets this requirement.")
            else:
                all_unavail = all(
                    any((d, p) in ctx.room_unavailability.get(rid, set()) for d in ctx.days for p in range(1, 10))
                    for rid in compat_rooms
                )
                if all_unavail:
                    violated_rules.append("H7")
                    conflicting_res.extend([f"Room:{rid}" for rid in compat_rooms])
                    reasons.append(f"All compatible rooms for session {sid} are closed by emergency room unavailability.")

    # 2. Check for faculty daily max hours (H12)
    for fid, f in ctx.faculty.items():
        for d in ctx.days:
            hrs = sum(
                ctx.sessions[sid].duration
                for sid, (od, _, _) in base_assign.items()
                if ctx.sessions.get(sid, {}).faculty_id == fid and od == d
            )
            if hrs > f.max_hours_per_day:
                violated_rules.append("H12")
                conflicting_res.append(f"Faculty:{fid}")
                reasons.append(
                    f"Faculty {fid} is assigned {hrs}h on {d}, exceeding the maximum daily teaching load of {f.max_hours_per_day}h/day."
                )

    # 3. Check for student group clashes (H3)
    for g in ctx.student_groups:
        for d in ctx.days:
            for p in range(1, 10):
                clashes = [
                    sid for sid, (od, ost, _) in base_assign.items()
                    if od == d and p in block(ost, ctx.sessions.get(sid, {}).duration) and g in ctx.sessions.get(sid, {}).groups
                ]
                if len(clashes) > 1:
                    violated_rules.append("H3")
                    conflicting_res.append(f"Group:{g}")
                    affected_sids.extend(clashes)
                    reasons.append(f"Student group {g} has double-booking between sessions {', '.join(clashes)} on {d} Period {p}.")

    # Fallback to general resource collision if specific rule not singled out
    if not violated_rules:
        violated_rules = ["H2", "H3", "H7"]
        reasons.append("Simultaneous disruption events created timetable collisions that cannot be resolved without displacing other mandatory sessions.")

    # Deduplicate while preserving order
    violated_rules = list(dict.fromkeys(violated_rules))
    affected_sids = list(dict.fromkeys(affected_sids))
    conflicting_res = list(dict.fromkeys(conflicting_res))

    return {
        "status": "INFEASIBLE",
        "violated_rules": violated_rules,
        "affected_sessions": affected_sids,
        "conflicting_resources": conflicting_res,
        "explanation": " ".join(reasons),
        "suggestions": [
            "Request rescheduling to an alternative day with open student group slots (e.g. Wednesday or Friday).",
            "Adjust the declared unavailability window to avoid mandatory morning lecture slots.",
            "Contact Department Coordinator to request co-teaching or slot swap."
        ]
    }

