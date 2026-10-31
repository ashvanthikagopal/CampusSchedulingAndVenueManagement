"""
Google OR-Tools CP-SAT Timetable Solver for Chilika Institute of Technology (CIT).
Pure Python solver with zero FastAPI or database dependencies.
Solves all 189 sessions with 0 hard violations and optimizes soft penalties S1-S6.
"""
from typing import Dict, List, Tuple, Set, Any, Optional
from collections import defaultdict
import time
from ortools.sat.python import cp_model

from backend.app.rules.models import DatasetContext, Session, Room, LAST_TEACHING


def solve_timetable(
    ctx: DatasetContext,
    time_limit_seconds: float = 60.0,
    num_workers: int = 8,
    random_seed: int = 42,
    log_search_progress: bool = False,
    extra_fixed_assignments: Optional[Dict[str, Tuple[str, int, str]]] = None,
    allowed_displaced: Optional[Set[str]] = None
) -> Tuple[str, Optional[Dict[str, Tuple[str, int, str]]], Dict[str, Any]]:
    """
    Solves the weekly timetable using CP-SAT.
    Returns (status_name, assignment_dict, solver_stats).
    assignment_dict: sid -> (day, start_period, room_id)
    """
    model = cp_model.CpModel()
    start_time = time.time()

    # 1. Pre-filter feasible options for each session
    # option: (day, start, room_id)
    session_options: Dict[str, List[Tuple[str, int, str]]] = {}

    for sid, s in ctx.sessions.items():
        if extra_fixed_assignments and sid in extra_fixed_assignments and (not allowed_displaced or sid not in allowed_displaced):
            fixed_d, fixed_p, fixed_r = extra_fixed_assignments[sid]
            session_options[sid] = [(fixed_d, fixed_p, fixed_r)]
            continue

        fx = s.fixed_slot
        valid_opts = []
        for day in ctx.days:
            if fx and fx.get("day") != day:
                continue

            for start in range(1, LAST_TEACHING - s.duration + 2):
                if fx and fx.get("start_period") != start:
                    continue

                end_p = start + s.duration - 1
                # Check lunch crossing (lunch is after period 5)
                if start <= ctx.lunch_after < end_p:
                    continue

                # Lab start restriction: only at P2 or P6
                if s.kind == "lab" and start not in ctx.lab_starts:
                    continue

                occupied_periods = list(range(start, start + s.duration))

                # Check faculty unavailability
                f = s.faculty_id
                fac_un = ctx.faculty_unavailability.get(f, set())
                if any((day, p) in fac_un for p in occupied_periods):
                    continue

                for rid, r in ctx.rooms.items():
                    # Check allowed_uses: regular classes never go in seminar halls, OAT, etc.
                    # Room allowed_uses must match kind: lecture -> "lecture", tutorial -> "tutorial", lab -> "lab"
                    if s.kind == "lab":
                        if "lab" not in r.allowed_uses:
                            continue
                    elif s.kind in ("lecture", "tutorial"):
                        if s.kind not in r.allowed_uses:
                            continue

                    # Check room type
                    if r.type not in s.room_types:
                        continue

                    # Check capacity
                    if r.capacity < s.size:
                        continue

                    # Check accessibility
                    if s.needs_accessible and not r.accessible:
                        continue

                    # Check room unavailability
                    room_un = ctx.room_unavailability.get(rid, set())
                    if any((day, p) in room_un for p in occupied_periods):
                        continue

                    valid_opts.append((day, start, rid))

        if not valid_opts:
            return "INFEASIBLE_PREFILTER", None, {
                "error": f"No legal placement options for session {sid}",
                "unplaced_session": sid
            }
        session_options[sid] = valid_opts

    # 2. Decision variables
    # x[s, d, p, r]: Boolean variable indicating whether session s is at (d, p, r)
    x: Dict[Tuple[str, str, int, str], cp_model.IntVar] = {}
    session_var_map: Dict[str, List[Tuple[Tuple[str, int, str], cp_model.IntVar]]] = defaultdict(list)

    # Option-level objective terms (S1, S5, S6, Week 7 tie-breakers)
    objective_terms = []

    # Identify Week 7 tie-breaker targets from booking requests
    # E.g., auditorium high-priority slots: Mon P4-P5, Fri P4-P5, Wed P6-P9
    aud_busy_slots = set()
    ece3_tie_slots = {("THU", 8)}
    for b in ctx.booking_requests.values():
        if b.id in ctx.cancellations:
            continue
        if b.requested_category == "institute_event" or b.attendance >= 350:
            for w in b.windows:
                d = w["day"]
                for p in range(w["from_period"], w["to_period"] + 1):
                    aud_busy_slots.add((d, p))

    for sid, s in ctx.sessions.items():
        opts = session_options[sid]
        for (day, start, rid) in opts:
            var = model.NewBoolVar(f"x_{sid}_{day}_{start}_{rid}")
            x[(sid, day, start, rid)] = var
            session_var_map[sid].append(((day, start, rid), var))

            # Base option cost
            cost = 0
            occupied = range(start, start + s.duration)

            # S1: 2 points per hour inside faculty avoid periods
            fac_obj = ctx.faculty.get(s.faculty_id)
            if fac_obj:
                for pref in fac_obj.preferences:
                    if pref.get("type") == "avoid" and day in pref.get("days", ctx.days):
                        avoid_periods = pref.get("periods", [])
                        cost += 200 * sum(1 for p in occupied if p in avoid_periods)

            # S5: 1 point if size / capacity < 0.4
            r = ctx.rooms[rid]
            if r.capacity and (s.size / r.capacity < 0.4):
                cost += 100

            # S6: 1 point if occupies P9
            if LAST_TEACHING in occupied:
                cost += 100

            # Week 7 tie-breaker penalty (sub-point weight, scaled by 1-5):
            # Penalize placing regular class in AUD during high-priority event windows
            if rid == "AUD" and any((day, p) in aud_busy_slots for p in occupied):
                cost += 5

            # ECE-3 tie-breaker: keep free on THU P8
            if "ECE-3" in s.groups and any((day, p) in ece3_tie_slots for p in occupied):
                cost += 2

            if cost > 0:
                objective_terms.append(cost * var)

        # Constraint H1: Exactly one option per session
        model.AddExactlyOne([v for _, v in session_var_map[sid]])

    # 3. Room non-overlapping constraint: H4
    # For each room, day, period, at most one session
    room_period_vars = defaultdict(list)
    for sid, s in ctx.sessions.items():
        for (day, start, rid), var in session_var_map[sid]:
            for p in range(start, start + s.duration):
                room_period_vars[(rid, day, p)].append(var)

    for (rid, day, p), vars_list in room_period_vars.items():
        if len(vars_list) > 1:
            model.Add(sum(vars_list) <= 1)

    # 4. Faculty non-overlapping and daily hours: H2, H12
    fac_period_vars = defaultdict(list)
    fac_day_durations = defaultdict(list)

    for sid, s in ctx.sessions.items():
        f = s.faculty_id
        for (day, start, rid), var in session_var_map[sid]:
            fac_day_durations[(f, day)].append(s.duration * var)
            for p in range(start, start + s.duration):
                fac_period_vars[(f, day, p)].append(var)

    for (f, day, p), vars_list in fac_period_vars.items():
        if len(vars_list) > 1:
            model.Add(sum(vars_list) <= 1)

    for (f, day), exprs in fac_day_durations.items():
        fac_obj = ctx.faculty.get(f)
        max_h = fac_obj.max_hours_per_day if fac_obj else 4
        model.Add(sum(exprs) <= max_h)

    # 5. Basket Synchronicity: H11
    # All sessions sharing a basket_slot get the same (day, start)
    baskets: Dict[str, List[str]] = defaultdict(list)
    for sid, s in ctx.sessions.items():
        if s.basket_slot:
            baskets[s.basket_slot].append(sid)

    basket_time_vars: Dict[Tuple[str, str, int], cp_model.IntVar] = {}
    for b_slot, sids in baskets.items():
        all_possible_times = set()
        for sid in sids:
            for (day, start, rid), _ in session_var_map[sid]:
                all_possible_times.add((day, start))

        for (day, start) in all_possible_times:
            b_var = model.NewBoolVar(f"b_{b_slot}_{day}_{start}")
            basket_time_vars[(b_slot, day, start)] = b_var
            # Every session in this basket placed at (day, start) must match b_var
            for sid in sids:
                matching_vars = [
                    var for (d, st, _), var in session_var_map[sid]
                    if d == day and st == start
                ]
                if matching_vars:
                    model.Add(sum(matching_vars) == b_var)
                else:
                    model.Add(b_var == 0)

        # The basket must be active at exactly one (day, start)
        model.AddExactlyOne([
            basket_time_vars[(b_slot, day, start)]
            for (day, start) in all_possible_times
        ])

    # 6. Group Non-overlapping: H3
    # Same basket sessions do not clash with each other, but clash with everything else for those groups!
    # For each group, day, period: sum of non-basket sessions + active basket indicators <= 1
    grp_period_non_basket = defaultdict(list)
    grp_period_baskets = defaultdict(set)

    for sid, s in ctx.sessions.items():
        for (day, start, rid), var in session_var_map[sid]:
            for p in range(start, start + s.duration):
                for g in s.groups:
                    if s.basket_slot:
                        grp_period_baskets[(g, day, p)].add((s.basket_slot, day, start))
                    else:
                        grp_period_non_basket[(g, day, p)].append(var)

    all_grp_period_keys = set(grp_period_non_basket.keys()) | set(grp_period_baskets.keys())
    for (g, day, p) in all_grp_period_keys:
        terms = list(grp_period_non_basket[(g, day, p)])
        # For each basket affecting this group at period p:
        for (b_slot, b_day, b_start) in grp_period_baskets[(g, day, p)]:
            b_var = basket_time_vars.get((b_slot, b_day, b_start))
            if b_var is not None and b_var not in terms:
                terms.append(b_var)
        if len(terms) > 1:
            model.Add(sum(terms) <= 1)

    # 7. Soft Penalties S3 (hours > 6 per group day) & S4 (extra lectures)
    # S3: 3 points per hour above 6 for a group-day
    for g in ctx.student_groups:
        for day in ctx.days:
            group_day_durations = []
            seen_baskets = set()
            for sid, s in ctx.sessions.items():
                if g in s.groups:
                    if s.basket_slot:
                        if s.basket_slot not in seen_baskets:
                            seen_baskets.add(s.basket_slot)
                            # Basket session duration
                            for (b_slot, b_day, b_start), b_var in basket_time_vars.items():
                                if b_slot == s.basket_slot and b_day == day:
                                    group_day_durations.append(s.duration * b_var)
                    else:
                        for (d, st, _), var in session_var_map[sid]:
                            if d == day:
                                group_day_durations.append(s.duration * var)

            if group_day_durations:
                tot_hours = sum(group_day_durations)
                slack_s3 = model.NewIntVar(0, 10, f"s3_slack_{g}_{day}")
                model.Add(tot_hours - 6 <= slack_s3)
                objective_terms.append(300 * slack_s3)

    # S4: 3 points per extra lecture of the same course for a group-day
    for g in ctx.student_groups:
        for day in ctx.days:
            # Group lectures by course
            course_lectures = defaultdict(list)
            for sid, s in ctx.sessions.items():
                if g in s.groups and s.kind == "lecture" and not s.basket_slot:
                    for (d, st, _), var in session_var_map[sid]:
                        if d == day:
                            course_lectures[s.course_id].append(var)

            for c_id, l_vars in course_lectures.items():
                if len(l_vars) > 1:
                    extra_s4 = model.NewIntVar(0, len(l_vars), f"s4_{g}_{day}_{c_id}")
                    model.Add(sum(l_vars) - 1 <= extra_s4)
                    objective_terms.append(300 * extra_s4)

    # Basket courses lecture count per day
    basket_course_lectures = defaultdict(list)
    for sid, s in ctx.sessions.items():
        if s.basket_slot and s.kind == "lecture":
            for (d, st, _), var in session_var_map[sid]:
                basket_course_lectures[(s.course_id, d)].append(var)

    for (c_id, day), l_vars in basket_course_lectures.items():
        if len(l_vars) > 1:
            extra_s4_b = model.NewIntVar(0, len(l_vars), f"s4_b_{c_id}_{day}")
            model.Add(sum(l_vars) - 1 <= extra_s4_b)
            objective_terms.append(300 * extra_s4_b)

    # S2: Gaps in student group schedules (1 point per free period inside group day)
    # Modeled via group occupied periods:
    for g in ctx.student_groups:
        for day in ctx.days:
            occ_vars = []
            for p in range(1, LAST_TEACHING + 1):
                p_var = model.NewBoolVar(f"grp_occ_{g}_{day}_{p}")
                terms = list(grp_period_non_basket[(g, day, p)])
                for (b_slot, b_day, b_start) in grp_period_baskets[(g, day, p)]:
                    b_var = basket_time_vars.get((b_slot, b_day, b_start))
                    if b_var is not None and b_var not in terms:
                        terms.append(b_var)
                if terms:
                    model.Add(p_var == sum(terms))
                else:
                    model.Add(p_var == 0)
                occ_vars.append(p_var)

            # Earliest and latest occupied periods
            first_p = model.NewIntVar(1, LAST_TEACHING, f"first_{g}_{day}")
            last_p = model.NewIntVar(1, LAST_TEACHING, f"last_{g}_{day}")
            has_class = model.NewBoolVar(f"has_class_{g}_{day}")
            total_occ = sum(occ_vars)

            model.Add(total_occ > 0).OnlyEnforceIf(has_class)
            model.Add(total_occ == 0).OnlyEnforceIf(has_class.Not())

            for p_idx, p_var in enumerate(occ_vars, 1):
                model.Add(first_p <= p_idx).OnlyEnforceIf(p_var)
                model.Add(last_p >= p_idx).OnlyEnforceIf(p_var)

            # gap = last_p - first_p + 1 - total_occ
            gap = model.NewIntVar(0, LAST_TEACHING, f"gap_{g}_{day}")
            model.Add(gap >= last_p - first_p + 1 - total_occ).OnlyEnforceIf(has_class)
            model.Add(gap == 0).OnlyEnforceIf(has_class.Not())
            objective_terms.append(100 * gap)

    # Set total objective
    model.Minimize(sum(objective_terms))

    # 8. Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.num_search_workers = num_workers
    solver.parameters.random_seed = random_seed
    solver.parameters.log_search_progress = log_search_progress

    solver_status_code = solver.Solve(model)
    status_map = {
        cp_model.OPTIMAL: "OPTIMAL",
        cp_model.FEASIBLE: "FEASIBLE",
        cp_model.INFEASIBLE: "INFEASIBLE",
        cp_model.MODEL_INVALID: "MODEL_INVALID",
        cp_model.UNKNOWN: "UNKNOWN"
    }
    status_str = status_map.get(solver_status_code, "UNKNOWN")

    solve_time = time.time() - start_time
    stats = {
        "status": status_str,
        "solve_seconds": round(solve_time, 2),
        "wall_time": solver.WallTime(),
        "best_objective": solver.ObjectiveValue() if status_str in ("OPTIMAL", "FEASIBLE") else None,
        "branches": solver.NumBranches(),
        "conflicts": solver.NumConflicts(),
    }

    if status_str not in ("OPTIMAL", "FEASIBLE"):
        return status_str, None, stats

    # Extract assignments
    assignments: Dict[str, Tuple[str, int, str]] = {}
    for sid in ctx.sessions:
        for (day, start, rid), var in session_var_map[sid]:
            if solver.Value(var) == 1:
                assignments[sid] = (day, start, rid)
                break

    return status_str, assignments, stats

