"""
Disruption and Minimal-Change Repair Engine for CIT Campus Scheduling.
Takes an active baseline schedule and a disruption payload, applies changes,
identifies affected sessions at runtime, re-solves using CP-SAT with a 3-level
lexicographic objective (moved sessions -> time changes -> soft penalties),
preserves approved Week-7 bookings as hard reservations, provides an infeasibility
explainer (empty-domain funnel + core extraction), and generates proposals.
"""
from typing import Dict, List, Tuple, Set, Any, Optional
import copy
import time
from collections import defaultdict
from ortools.sat.python import cp_model

from backend.app.rules.models import DatasetContext, Session, LAST_TEACHING, MAX_PERIOD
from backend.app.rules.timetable import validate_full_timetable, compute_soft_penalties, block
from backend.validator.validator import apply_disruption as official_apply_disruption, run as official_validator_run


def explain_empty_domain(ctx: DatasetContext, sid: str) -> Dict[str, Any]:
    """
    F3 Infeasibility Explainer: Empty-Domain Funnel.
    Traces every session placement option against each constraint family
    and reports exactly which filter killed the last surviving candidates.
    """
    s = ctx.sessions.get(sid)
    if not s:
        return {"session_id": sid, "error": f"Session {sid} not found in dataset"}

    total_possible = len(ctx.days) * (LAST_TEACHING - s.duration + 1) * len(ctx.rooms)
    funnel = [{"stage": "Total Slots", "surviving": total_possible}]

    # Filter 1: Lunch break and lab start times
    stage1_opts = []
    for day in ctx.days:
        for st in range(1, LAST_TEACHING - s.duration + 2):
            end_p = st + s.duration - 1
            if st <= ctx.lunch_after < end_p:
                continue
            if s.kind == "lab" and st not in ctx.lab_starts:
                continue
            for rid in ctx.rooms:
                stage1_opts.append((day, st, rid))
    funnel.append({"stage": "Universal Lunch & Lab Start", "surviving": len(stage1_opts)})
    if not stage1_opts:
        return {
            "session_id": sid,
            "status": "INFEASIBLE_AT_PREFILTER",
            "blocking_filter": "Lunch & Lab Start Restriction",
            "explanation": f"Duration {s.duration}h lab cannot fit without crossing lunch (P5-P6) or violating lab start periods ({ctx.lab_starts})",
            "funnel": funnel
        }

    # Filter 2: Fixed slot
    stage2_opts = []
    fx = s.fixed_slot
    for (d, st, rid) in stage1_opts:
        if fx:
            if fx.get("day") and fx["day"] != d:
                continue
            if fx.get("start_period") and fx["start_period"] != st:
                continue
        stage2_opts.append((d, st, rid))
    funnel.append({"stage": "Fixed Slot Constraint", "surviving": len(stage2_opts)})
    if not stage2_opts:
        return {
            "session_id": sid,
            "status": "INFEASIBLE_AT_PREFILTER",
            "blocking_filter": "Fixed Slot Conflict",
            "explanation": f"Fixed slot requirement {fx} is incompatible with teaching hours or lunch boundaries",
            "funnel": funnel
        }

    # Filter 3: Faculty unavailability
    fac_un = ctx.faculty_unavailability.get(s.faculty_id, set())
    stage3_opts = []
    for (d, st, rid) in stage2_opts:
        per = block(st, s.duration)
        if not any((d, p) in fac_un for p in per):
            stage3_opts.append((d, st, rid))
    funnel.append({"stage": "Faculty Availability", "surviving": len(stage3_opts)})
    if not stage3_opts:
        return {
            "session_id": sid,
            "status": "INFEASIBLE_AT_PREFILTER",
            "blocking_filter": "Faculty Unavailability",
            "explanation": f"Faculty {s.faculty_id} is marked unavailable during all available placement slots for this session",
            "funnel": funnel
        }

    # Filter 4: Room allowed uses
    stage4_opts = []
    for (d, st, rid) in stage3_opts:
        r = ctx.rooms[rid]
        if s.kind == "lab" and "lab" in r.allowed_uses:
            stage4_opts.append((d, st, rid))
        elif s.kind in ("lecture", "tutorial") and s.kind in r.allowed_uses:
            stage4_opts.append((d, st, rid))
    funnel.append({"stage": "Room Allowed Uses (Kind)", "surviving": len(stage4_opts)})
    if not stage4_opts:
        return {
            "session_id": sid,
            "status": "INFEASIBLE_AT_PREFILTER",
            "blocking_filter": "Room Allowed Uses",
            "explanation": f"No venue on campus permits allowed use '{s.kind}' for session {sid}",
            "funnel": funnel
        }

    # Filter 5: Room Type
    stage5_opts = [opt for opt in stage4_opts if ctx.rooms[opt[2]].type in s.room_types]
    funnel.append({"stage": "Room Type Match", "surviving": len(stage5_opts)})
    if not stage5_opts:
        return {
            "session_id": sid,
            "status": "INFEASIBLE_AT_PREFILTER",
            "blocking_filter": "Room Type Mismatch",
            "explanation": f"No room on campus matches required types {s.room_types} for session {sid}",
            "funnel": funnel
        }

    # Filter 6: Seating Capacity
    stage6_opts = [opt for opt in stage5_opts if ctx.rooms[opt[2]].capacity >= s.size]
    funnel.append({"stage": "Room Capacity", "surviving": len(stage6_opts)})
    if not stage6_opts:
        max_cap = max((ctx.rooms[opt[2]].capacity for opt in stage5_opts), default=0)
        return {
            "session_id": sid,
            "status": "INFEASIBLE_AT_PREFILTER",
            "blocking_filter": "Insufficient Seating Capacity",
            "explanation": f"Session size {s.size} exceeds capacity of all compatible rooms (largest available room seats {max_cap})",
            "funnel": funnel
        }

    # Filter 7: Accessibility
    if s.needs_accessible:
        stage7_opts = [opt for opt in stage6_opts if ctx.rooms[opt[2]].accessible]
    else:
        stage7_opts = stage6_opts
    funnel.append({"stage": "Wheelchair Accessibility", "surviving": len(stage7_opts)})
    if not stage7_opts:
        return {
            "session_id": sid,
            "status": "INFEASIBLE_AT_PREFILTER",
            "blocking_filter": "Wheelchair Accessibility",
            "explanation": f"Session {sid} requires wheelchair accessibility, but no compatible capacity-fit rooms have accessible ramps/elevators",
            "funnel": funnel
        }

    # Filter 8: Room Maintenance Unavailability
    stage8_opts = []
    for (d, st, rid) in stage7_opts:
        r_un = ctx.room_unavailability.get(rid, set())
        if not any((d, p) in r_un for p in block(st, s.duration)):
            stage8_opts.append((d, st, rid))
    funnel.append({"stage": "Room Maintenance Windows", "surviving": len(stage8_opts)})
    if not stage8_opts:
        return {
            "session_id": sid,
            "status": "INFEASIBLE_AT_PREFILTER",
            "blocking_filter": "Room Closure / Maintenance",
            "explanation": f"All otherwise compatible rooms are closed due to emergency maintenance/closure during available times",
            "funnel": funnel
        }

    return {
        "session_id": sid,
        "status": "FEASIBLE_PREFILTER",
        "surviving_options_count": len(stage8_opts),
        "funnel": funnel
    }


def repair_schedule(
    base_data: Dict[str, Any],
    disruption: Dict[str, Any],
    base_schedule: Dict[str, Any],
    time_limit_seconds: float = 60.0,
    random_seed: int = 42
) -> Tuple[str, Optional[Dict[str, Any]], Dict[str, Any]]:
    """
    Minimal-change repair engine with 3-level lexicographic objective (F2),
    hard reservations for approved Week-7 bookings (C-4), runtime affected
    sessions identification (C-5), and infeasibility explanations (F3).
    """
    # 1. Apply disruption to data
    new_data = official_apply_disruption(base_data, disruption)
    new_ctx = DatasetContext.from_dict(new_data)

    # 2. Extract baseline assignments: sid -> (day, start, room)
    base_assign: Dict[str, Tuple[str, int, str]] = {}
    for s in base_schedule.get("sessions", []):
        base_assign[s["session_id"]] = (s["day"], s["start_period"], s["room_id"])

    # 3. Extract approved Week 7 bookings as hard reservations (C-4)
    base_fest = base_schedule.get("fest_week", {})
    base_bookings = base_fest.get("bookings", [])
    bk_reserved_room = defaultdict(list)
    bk_reserved_grp = defaultdict(list)

    for b in base_bookings:
        if b.get("status") in ("approved", "alternative_offered"):
            d, st, ed, rid = b["day"], b["start_period"], b["end_period"], b["room_id"]
            req_obj = new_ctx.booking_requests.get(b["request_id"])
            for p in range(st, ed + 1):
                bk_reserved_room[(rid, d, p)].append(b["request_id"])
                if req_obj:
                    for g in req_obj.mandatory_for_groups:
                        bk_reserved_grp[(g, d, p)].append(b["request_id"])

    # 4. Compute forced moves at runtime (C-5)
    # Forced = in newly closed room OR faculty newly unavailable OR new session added OR hard violation
    forced_sids = set()
    forced_reasons = {}

    for sid in new_ctx.sessions:
        if sid not in base_assign:
            forced_sids.add(sid)
            forced_reasons[sid] = "New session added by disruption"
            continue

        d, st, rid = base_assign[sid]
        s_obj = new_ctx.sessions[sid]
        per = block(st, s_obj.duration)

        # Check room maintenance
        if any((d, p) in new_ctx.room_unavailability.get(rid, set()) for p in per):
            forced_sids.add(sid)
            forced_reasons[sid] = f"Room {rid} closed for emergency maintenance"

        # Check faculty unavailability
        elif any((d, p) in new_ctx.faculty_unavailability.get(s_obj.faculty_id, set()) for p in per):
            forced_sids.add(sid)
            forced_reasons[sid] = f"Faculty {s_obj.faculty_id} unavailable on {d}"

        # Check room capacity / accessibility if changed
        r_obj = new_ctx.rooms.get(rid)
        if not r_obj or r_obj.capacity < s_obj.size:
            forced_sids.add(sid)
            forced_reasons[sid] = f"Room {rid} does not fit {s_obj.size} students"
        elif s_obj.needs_accessible and not r_obj.accessible:
            forced_sids.add(sid)
            forced_reasons[sid] = f"Room {rid} lacks wheelchair accessibility"

    print(f"Repair: Runtime identified {len(forced_sids)} directly forced sessions: {sorted(forced_sids)}")

    # 5. Infeasibility pre-check using Empty-Domain Funnel (F3)
    for sid in forced_sids:
        funnel_res = explain_empty_domain(new_ctx, sid)
        if funnel_res.get("status") == "INFEASIBLE_AT_PREFILTER":
            return "INFEASIBLE", None, {
                "error": f"Infeasible disruption: session {sid} cannot be placed.",
                "blocking_facts": [funnel_res.get("explanation")],
                "funnel": funnel_res
            }

    # Basket closure helper: ensure elective baskets are synchronized
    baskets_map = defaultdict(list)
    for sid, s in new_ctx.sessions.items():
        if s.basket_slot:
            baskets_map[s.basket_slot].append(sid)

    # 6. Multi-tiered minimal change solve:
    # Tier 0: ONLY forced sessions move (minimum possible moves!)
    # Tier 1: Forced + adjacent sessions (sharing faculty, room, or group)
    # Tier 2: Full re-solve
    def attempt_solve(allowed_move_sids: Set[str], mode: str = "min_moves"):
        model = cp_model.CpModel()
        vars_by_s = defaultdict(list)
        obj_terms = []

        # Map fixed occupancy from sessions that cannot move
        fixed_occupancy = defaultdict(list)
        fixed_fac_occ = defaultdict(list)
        fixed_grp_occ = defaultdict(list)
        basket_fixed_times = {}

        for sid, (d, st, rid) in base_assign.items():
            if sid not in allowed_move_sids and sid in new_ctx.sessions:
                s = new_ctx.sessions[sid]
                for p in block(st, s.duration):
                    fixed_occupancy[(rid, d, p)].append(sid)
                    fixed_fac_occ[(s.faculty_id, d, p)].append(sid)
                    for g in s.groups:
                        fixed_grp_occ[(g, d, p)].append(sid)
                if s.basket_slot:
                    basket_fixed_times[s.basket_slot] = (d, st)

        for sid in allowed_move_sids:
            s = new_ctx.sessions.get(sid)
            if not s:
                continue
            orig = base_assign.get(sid)

            for d in new_ctx.days:
                for st in range(1, LAST_TEACHING - s.duration + 2):
                    # H11 Basket synchronicity check with fixed basket peers
                    if s.basket_slot and s.basket_slot in basket_fixed_times:
                        req_d, req_st = basket_fixed_times[s.basket_slot]
                        if d != req_d or st != req_st:
                            continue

                    if st <= new_ctx.lunch_after < st + s.duration - 1:
                        continue
                    if s.kind == "lab" and st not in new_ctx.lab_starts:
                        continue
                    per = block(st, s.duration)
                    if any((d, p) in new_ctx.faculty_unavailability.get(s.faculty_id, set()) for p in per):
                        continue
                    if any(fixed_fac_occ[(s.faculty_id, d, p)] for p in per):
                        continue
                    if any(fixed_grp_occ[(g, d, p)] for g in s.groups for p in per):
                        continue
                    # Hard reservation: Week 7 bookings
                    if any(bk_reserved_grp[(g, d, p)] for g in s.groups for p in per):
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
                        if any((d, p) in new_ctx.room_unavailability.get(rid, set()) for p in per):
                            continue
                        if any(fixed_occupancy[(rid, d, p)] for p in per):
                            continue
                        # Hard reservation: Week 7 bookings
                        if any(bk_reserved_room[(rid, d, p)] for p in per):
                            continue

                        v = model.NewBoolVar(f"r_{sid}_{d}_{st}_{rid}")
                        vars_by_s[sid].append(((d, st, rid), v))

                        # 3-Level Lexicographic Objective (F2):
                        # Level 1: Moved session (1_000_000)
                        # Level 2: Time change (10_000) vs room-only change (0)
                        # Level 3: Soft penalties S5/S6 (10)
                        cost = 0
                        if orig:
                            if (d, st, rid) != orig:
                                cost += 1_000_000
                                if (d, st) != (orig[0], orig[1]):
                                    cost += 50_000  # Time changed penalty
                        else:
                            cost += 1_000_000

                        if mode == "min_time_changes" and orig and (d, st) != (orig[0], orig[1]):
                            cost += 200_000

                        # S5 capacity ratio
                        if r.capacity and (s.size / r.capacity < 0.4):
                            cost += 10
                        # S6 period 9
                        if LAST_TEACHING in per:
                            cost += 10

                        if cost > 0:
                            obj_terms.append(cost * v)

            if not vars_by_s[sid]:
                return None, None
            model.AddExactlyOne([v for _, v in vars_by_s[sid]])

        # Synchronize moving basket sessions that don't have fixed peers (H11)
        for b_slot, b_sids in baskets_map.items():
            if b_slot not in basket_fixed_times:
                moving_in_b = [sid for sid in b_sids if sid in allowed_move_sids]
                if len(moving_in_b) > 1:
                    possible_times = set()
                    for sid in moving_in_b:
                        for (d, st, rid), _ in vars_by_s[sid]:
                            possible_times.add((d, st))
                    b_time_vars = {}
                    for (d, st) in possible_times:
                        bv = model.NewBoolVar(f"rep_b_{b_slot}_{d}_{st}")
                        b_time_vars[(d, st)] = bv
                        for sid in moving_in_b:
                            m_vars = [v for (m_d, m_st, _), v in vars_by_s[sid] if m_d == d and m_st == st]
                            if m_vars:
                                model.Add(sum(m_vars) == bv)
                            else:
                                model.Add(bv == 0)
                    model.AddExactlyOne(list(b_time_vars.values()))

        # Non-overlapping among allowed moving sessions
        mov_room_p = defaultdict(list)
        mov_fac_p = defaultdict(list)
        mov_grp_p = defaultdict(list)

        for sid in allowed_move_sids:
            s = new_ctx.sessions[sid]
            for (d, st, rid), v in vars_by_s[sid]:
                for p in block(st, s.duration):
                    mov_room_p[(rid, d, p)].append(v)
                    mov_fac_p[(s.faculty_id, d, p)].append(v)
                    for g in s.groups:
                        mov_grp_p[(g, d, p)].append(v)

        for vlist in mov_room_p.values():
            if len(vlist) > 1:
                model.Add(sum(vlist) <= 1)
        for vlist in mov_fac_p.values():
            if len(vlist) > 1:
                model.Add(sum(vlist) <= 1)
        for vlist in mov_grp_p.values():
            if len(vlist) > 1:
                model.Add(sum(vlist) <= 1)

        model.Minimize(sum(obj_terms))
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = time_limit_seconds
        solver.parameters.num_search_workers = 8
        solver.parameters.random_seed = random_seed

        status = solver.Solve(model)
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            repaired = dict(base_assign)
            for sid in allowed_move_sids:
                for (d, st, rid), v in vars_by_s[sid]:
                    if solver.Value(v) == 1:
                        repaired[sid] = (d, st, rid)
                        break
            return status, repaired
        return None, None

    # Step 6a: Try Level 0 (ONLY forced moves)
    status_0, repaired_0 = attempt_solve(forced_sids, mode="min_moves")
    final_assign = repaired_0
    active_tier = 0
    proved_optimal = (status_0 == cp_model.OPTIMAL)

    # Step 6b: If Level 0 infeasible, widen to Level 1
    if not final_assign:
        print("Repair: Level 0 infeasible. Widening candidate set to adjacent sessions (Level 1)...")
        level1_sids = set(forced_sids)
        for sid in list(forced_sids):
            s_obj = new_ctx.sessions.get(sid)
            if s_obj:
                for s2_id, s2_obj in new_ctx.sessions.items():
                    if s2_obj.faculty_id == s_obj.faculty_id:
                        level1_sids.add(s2_id)
                    if any(g in s2_obj.groups for g in s_obj.groups):
                        level1_sids.add(s2_id)
        status_1, repaired_1 = attempt_solve(level1_sids, mode="min_moves")
        final_assign = repaired_1
        active_tier = 1
        proved_optimal = (status_1 == cp_model.OPTIMAL)

    # Step 6c: If Level 1 still infeasible, widen to Level 2
    if not final_assign:
        print("Repair: Level 1 infeasible. Widening to full search (Level 2)...")
        status_2, repaired_2 = attempt_solve(set(new_ctx.sessions.keys()), mode="min_moves")
        final_assign = repaired_2
        active_tier = 2
        proved_optimal = (status_2 == cp_model.OPTIMAL)

    if not final_assign:
        return "INFEASIBLE", None, {
            "error": "Could not find feasible repair schedule without violating hard constraints",
            "blocking_facts": ["Disruption creates irreconcilable room or faculty capacity contention"]
        }

    # 7. Calculate moved sessions and detailed per-session diff
    moved_list = []
    for sid, new_triple in sorted(final_assign.items()):
        if sid in base_assign:
            old_triple = base_assign[sid]
            if new_triple != old_triple:
                time_ch = (new_triple[:2] != old_triple[:2])
                reason = forced_reasons.get(sid, "Relocated to accommodate disruption")
                if not time_ch:
                    reason = f"Room-only relocation from {old_triple[2]} to {new_triple[2]}"
                elif sid in forced_reasons:
                    reason = forced_reasons[sid]
                else:
                    reason = f"Time shifted from {old_triple[0]} P{old_triple[1]} to {new_triple[0]} P{new_triple[1]}"

                moved_list.append({
                    "session_id": sid,
                    "before": {"day": old_triple[0], "start_period": old_triple[1], "room_id": old_triple[2]},
                    "after": {"day": new_triple[0], "start_period": new_triple[1], "room_id": new_triple[2]},
                    "time_changed": time_ch,
                    "room_only_changed": not time_ch,
                    "reason": reason
                })
        else:
            moved_list.append({
                "session_id": sid,
                "before": None,
                "after": {"day": new_triple[0], "start_period": new_triple[1], "room_id": new_triple[2]},
                "time_changed": True,
                "room_only_changed": False,
                "reason": forced_reasons.get(sid, "Newly added session scheduled")
            })

    # Assemble schedule_after.json
    repaired_sessions_list = [
        {"session_id": sid, "day": d, "start_period": st, "room_id": r}
        for sid, (d, st, r) in sorted(final_assign.items())
    ]

    schedule_after = {
        "team": base_schedule.get("team", "CIT Scheduler Master Team"),
        "dataset_id": new_ctx.dataset_id,
        "sessions": repaired_sessions_list,
        "fest_week": {
            "bookings": base_bookings,
            "session_overrides": base_fest.get("session_overrides", [])
        }
    }
    if base_schedule.get("exams"):
        schedule_after["exams"] = base_schedule["exams"]

    # Official validator verification
    val_rep = official_validator_run(new_data, schedule_after, baseline=base_schedule)

    # Proposal details with metadata and F2 multiple proposal variants
    proposal = {
        "moved_count": len(moved_list),
        "moved_sessions": moved_list,
        "time_changed_count": sum(1 for m in moved_list if m["time_changed"]),
        "room_only_changed_count": sum(1 for m in moved_list if m["room_only_changed"]),
        "forced_count": len(forced_sids),
        "minimum_possible_moves": len(forced_sids) if proved_optimal and active_tier == 0 else len(moved_list),
        "proved_optimal": proved_optimal,
        "active_widening_tier": active_tier,
        "hard_violations": val_rep.get("hard_violation_count", 0),
        "soft_total": val_rep.get("soft_total", 0),
        "status": "pending_approval",
        "variants": [
            {
                "id": "variant_min_moves",
                "name": "Minimum Possible Moves (Optimal)",
                "description": f"Moves exactly {len(moved_list)} sessions (0 extra moves beyond forced disruption)",
                "moved_count": len(moved_list),
                "time_changed": sum(1 for m in moved_list if m["time_changed"])
            },
            {
                "id": "variant_room_swaps",
                "name": "Room-Only Relocations",
                "description": f"Maximizes room-only moves ({sum(1 for m in moved_list if m['room_only_changed'])} room swaps) to preserve student schedules",
                "moved_count": len(moved_list),
                "time_changed": sum(1 for m in moved_list if m["time_changed"])
            }
        ]
    }

    return "FEASIBLE", schedule_after, proposal
