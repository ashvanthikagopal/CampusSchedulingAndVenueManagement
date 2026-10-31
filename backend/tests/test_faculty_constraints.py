"""
Comprehensive Test Suite for Faculty Timetable Constraints.
Verifies backend/app/rules/faculty_checks.py deterministic enforcement:
- 15 Hard Constraints (H1-H12, H14, Fest Bookings, Bounds, Ownership)
- Soft Rules S1-S6 calculation and breakdown
- 50-move parity test against validate_full_timetable
- Legal options enumeration & sorting
- Infeasible diagnostics
- Official validator 0 hard violations verification
"""
import copy
import json
import pytest
from collections import defaultdict
from pathlib import Path

from backend.app.rules.models import DatasetContext
from backend.app.rules.timetable import validate_full_timetable, compute_soft_penalties, block
from backend.app.rules.faculty_checks import check_candidate_move, enumerate_legal_options, explain_infeasible
from backend.validator.validator import run as official_validator_run

DATA_PATH = Path("data/starter_dataset/cit_public.json")
SCHED_PATH = Path("exports/schedule.json")


@pytest.fixture
def dataset():
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def active_schedule():
    with open(SCHED_PATH, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def ctx(dataset):
    return DatasetContext.from_dict(dataset)


@pytest.fixture
def base_assign(active_schedule):
    return {
        e["session_id"]: (e["day"], e["start_period"], e["room_id"])
        for e in active_schedule.get("sessions", [])
    }


# -------------------------------------------------------------
# 1. HARD RULE TESTS (15 Rules)
# -------------------------------------------------------------

def test_hard_rule_h1_unknown_session(ctx, base_assign):
    """H1: Unknown session must be rejected with H1."""
    res = check_candidate_move(ctx, base_assign, "UNKNOWN_SESSION_999", "MON", 1, "CR-101")
    assert not res["ok"]
    assert any(v["code"] == "H1" for v in res["hard_violations"])


def test_hard_rule_h1_invalid_day(ctx, base_assign):
    """H1: Invalid day like 'SUN' must be rejected."""
    sid = list(ctx.sessions.keys())[0]
    res = check_candidate_move(ctx, base_assign, sid, "SUN", 1, "CR-101")
    assert not res["ok"]
    assert any(v["code"] == "H1" and "Day" in v["rule"] for v in res["hard_violations"])


def test_hard_rule_h1_unknown_room(ctx, base_assign):
    """H1: Nonexistent room must be rejected."""
    sid = list(ctx.sessions.keys())[0]
    res = check_candidate_move(ctx, base_assign, sid, "MON", 1, "NON_EXISTENT_ROOM_XYZ")
    assert not res["ok"]
    assert any(v["code"] == "H1" and "Room" in v["rule"] for v in res["hard_violations"])


def test_hard_rule_h2_faculty_clash(ctx, base_assign):
    """H2: Proposing a slot where faculty is already teaching another session must fail."""
    # Find two distinct sessions with same faculty
    fac_sessions = {}
    for sid, s in ctx.sessions.items():
        fac_sessions.setdefault(s.faculty_id, []).append(sid)

    pair = next((sids for sids in fac_sessions.values() if len(sids) >= 2), None)
    assert pair is not None, "Need at least one faculty with >= 2 sessions"

    s1, s2 = pair[0], pair[1]
    day2, start2, room2 = base_assign[s2]

    # Try placing s1 at the exact same day & start as s2
    res = check_candidate_move(ctx, base_assign, s1, day2, start2, "CR-101")
    assert not res["ok"]
    assert any(v["code"] == "H2" for v in res["hard_violations"])


def test_hard_rule_h3_group_clash_and_basket_exemption(ctx, base_assign):
    """H3: Group clash must be caught, but sessions sharing the same basket_slot must be exempt."""
    # Find two non-basket sessions that share a student group
    found = None
    for s1_id, s1 in ctx.sessions.items():
        if s1.basket_slot:
            continue
        for s2_id, s2 in ctx.sessions.items():
            if s2_id == s1_id or s2.basket_slot:
                continue
            shared_groups = set(s1.groups) & set(s2.groups)
            if shared_groups:
                found = (s1_id, s2_id, shared_groups)
                break
        if found:
            break

    assert found is not None
    s1_id, s2_id, _ = found
    d2, st2, r2 = base_assign[s2_id]

    res = check_candidate_move(ctx, base_assign, s1_id, d2, st2, "CR-101")
    assert not res["ok"]
    assert any(v["code"] == "H3" for v in res["hard_violations"])


def test_hard_rule_h4_room_clash(ctx, base_assign):
    """H4: Two sessions placed in the same room at the same time must fail."""
    sid1 = list(base_assign.keys())[0]
    sid2 = list(base_assign.keys())[1]
    d2, st2, r2 = base_assign[sid2]

    res = check_candidate_move(ctx, base_assign, sid1, d2, st2, r2)
    assert not res["ok"]
    assert any(v["code"] == "H4" for v in res["hard_violations"])


def test_hard_rule_h5_capacity(ctx, base_assign):
    """H5: Room capacity < session size must fail."""
    # Find a large session and a small room
    large_sid = max(ctx.sessions.keys(), key=lambda k: ctx.sessions[k].size)
    large_s = ctx.sessions[large_sid]
    small_rid = min(ctx.rooms.keys(), key=lambda k: ctx.rooms[k].capacity)
    small_r = ctx.rooms[small_rid]

    if large_s.size > small_r.capacity:
        res = check_candidate_move(ctx, base_assign, large_sid, "MON", 1, small_rid)
        assert not res["ok"]
        assert any(v["code"] == "H5" for v in res["hard_violations"])


def test_hard_rule_h6_room_type(ctx, base_assign):
    """H6: Lab in a classroom or lecture in a wrong lab must fail."""
    lab_sids = [sid for sid, s in ctx.sessions.items() if s.kind == "lab"]
    if lab_sids:
        lab_sid = lab_sids[0]
        # Find a classroom
        cr_room = next((rid for rid, r in ctx.rooms.items() if r.type == "classroom"), None)
        if cr_room:
            res = check_candidate_move(ctx, base_assign, lab_sid, "MON", 2, cr_room)
            assert not res["ok"]
            assert any(v["code"] == "H6" for v in res["hard_violations"])


def test_hard_rule_h7_faculty_unavailability(ctx, base_assign):
    """H7: Placing session during faculty unavailable slot must fail."""
    fac_unavail = next(((f, slots) for f, slots in ctx.faculty_unavailability.items() if slots), None)
    if fac_unavail:
        f_id, slots = fac_unavail
        day, period = list(slots)[0]
        f_sids = [sid for sid, s in ctx.sessions.items() if s.faculty_id == f_id]
        if f_sids:
            res = check_candidate_move(ctx, base_assign, f_sids[0], day, period, "CR-101")
            assert not res["ok"]
            assert any(v["code"] == "H7" for v in res["hard_violations"])


def test_hard_rule_h8_room_unavailability(ctx, base_assign):
    """H8: Placing session in room during maintenance window must fail."""
    room_unavail = next(((r, slots) for r, slots in ctx.room_unavailability.items() if slots), None)
    if room_unavail:
        r_id, slots = room_unavail
        day, period = list(slots)[0]
        sid = list(ctx.sessions.keys())[0]
        res = check_candidate_move(ctx, base_assign, sid, day, period, r_id)
        assert not res["ok"]
        assert any(v["code"] == "H8" for v in res["hard_violations"])


def test_hard_rule_h9_lunch_crossing_and_lab_start(ctx, base_assign):
    """H9: Session crossing period 5 lunch or lab not starting at P2/P6 must fail."""
    # 2-hour lecture starting at P5 crosses into P6
    dur2_sids = [sid for sid, s in ctx.sessions.items() if s.duration >= 2 and s.kind != "lab"]
    if dur2_sids:
        res = check_candidate_move(ctx, base_assign, dur2_sids[0], "MON", 5, "CR-101")
        assert not res["ok"]
        assert any(v["code"] == "H9" and "Lunch" in v["rule"] for v in res["hard_violations"])

    # 3-hour lab starting at P3 (must start at P2 or P6)
    lab_sids = [sid for sid, s in ctx.sessions.items() if s.kind == "lab"]
    if lab_sids:
        res_lab = check_candidate_move(ctx, base_assign, lab_sids[0], "MON", 3, "LAB-1")
        assert not res_lab["ok"]
        assert any(v["code"] == "H9" for v in res_lab["hard_violations"])


def test_hard_rule_h10_accessibility(ctx, base_assign):
    """H10: Session needing accessibility in inaccessible room must fail."""
    acc_sids = [sid for sid, s in ctx.sessions.items() if s.needs_accessible]
    non_acc_rooms = [rid for rid, r in ctx.rooms.items() if not r.accessible]
    if acc_sids and non_acc_rooms:
        res = check_candidate_move(ctx, base_assign, acc_sids[0], "MON", 1, non_acc_rooms[0])
        assert not res["ok"]
        assert any(v["code"] == "H10" for v in res["hard_violations"])


def test_hard_rule_h11_elective_basket_sync(ctx, base_assign):
    """H11: Moving one track of an elective basket to a different slot must fail."""
    basket_sessions = defaultdict(list)
    for sid, s in ctx.sessions.items():
        if s.basket_slot:
            basket_sessions[s.basket_slot].append(sid)

    if basket_sessions:
        b_slot = list(basket_sessions.keys())[0]
        sids = basket_sessions[b_slot]
        if len(sids) >= 2:
            s1, s2 = sids[0], sids[1]
            d1, st1, r1 = base_assign[s1]
            # Try moving s1 to another slot while s2 remains at (d1, st1)
            target_st = 7 if st1 != 7 else 8
            res = check_candidate_move(ctx, base_assign, s1, d1, target_st, r1)
            assert not res["ok"]
            assert any(v["code"] == "H11" for v in res["hard_violations"])


def test_hard_rule_h12_faculty_max_hours(ctx, base_assign):
    """H12: Exceeding faculty max hours per day must fail."""
    # Find faculty F06 (max 4 hrs)
    f06_sessions = [sid for sid, s in ctx.sessions.items() if s.faculty_id == "F06"]
    assert f06_sessions, "Faculty F06 should have sessions"

    # Count how many hours F06 teaches on each day
    f06_day_hours = defaultdict(int)
    for sid in f06_sessions:
        d, _, _ = base_assign[sid]
        f06_day_hours[d] += ctx.sessions[sid].duration

    # Find a day where F06 already teaches 4 hours or move session to push over 4 hours
    sid_to_test = f06_sessions[0]
    # Artificially test placing a 2h session on a day with 3h or 4h
    full_day = max(f06_day_hours.keys(), key=lambda d: f06_day_hours[d])
    # If full_day already has max hours, any extra session on that day must violate H12
    # Create test scenario:
    res = check_candidate_move(ctx, base_assign, sid_to_test, full_day, 1, "CR-101")
    # If projected exceeds max_hours_per_day
    fac_obj = ctx.faculty["F06"]
    projected = sum(ctx.sessions[osid].duration for osid in f06_sessions if osid != sid_to_test and base_assign[osid][0] == full_day) + ctx.sessions[sid_to_test].duration
    if projected > fac_obj.max_hours_per_day:
        assert not res["ok"]
        assert any(v["code"] == "H12" for v in res["hard_violations"])


def test_hard_rule_h14_fixed_slot(ctx, base_assign):
    """H14: Fixed slot sessions cannot be moved to another day or period."""
    fixed_sids = [sid for sid, s in ctx.sessions.items() if s.fixed_slot]
    if fixed_sids:
        fx_sid = fixed_sids[0]
        s_obj = ctx.sessions[fx_sid]
        fx = s_obj.fixed_slot
        wrong_day = "FRI" if fx.get("day") != "FRI" else "MON"
        res = check_candidate_move(ctx, base_assign, fx_sid, wrong_day, fx.get("start_period"), "CR-101")
        assert not res["ok"]
        assert any(v["code"] == "H14" for v in res["hard_violations"])


def test_hard_rule_approved_fest_bookings_clash(ctx, base_assign):
    """Approved bookings: Room clash and mandatory group clash."""
    sid = list(ctx.sessions.keys())[0]
    s_obj = ctx.sessions[sid]

    # Create an approved booking for room CR-101 on MON P2
    mock_booking = {
        "id": "fest_b1",
        "title": "Robotics Fest",
        "status": "approved",
        "assigned_day": "MON",
        "start_period": 2,
        "end_period": 3,
        "assigned_room": "CR-101",
        "mandatory_for_groups": []
    }

    res = check_candidate_move(ctx, base_assign, sid, "MON", 2, "CR-101", bookings=[mock_booking])
    assert not res["ok"]
    assert any(v["code"] == "BOOKING_ROOM_CLASH" for v in res["hard_violations"])

    # Test mandatory group clash
    grp = s_obj.groups[0]
    mock_group_booking = {
        "id": "fest_b2",
        "title": "Annual Inauguration",
        "status": "approved",
        "assigned_day": "MON",
        "start_period": 1,
        "end_period": 2,
        "assigned_room": "AUD-1",
        "mandatory_for_groups": [grp]
    }
    res_grp = check_candidate_move(ctx, base_assign, sid, "MON", 1, "CR-102", bookings=[mock_group_booking])
    assert not res_grp["ok"]
    assert any(v["code"] == "BOOKING_GROUP_CLASH" for v in res_grp["hard_violations"])


def test_hard_rule_valid_period_bounds(ctx, base_assign):
    """Teaching periods must be within P1-P9; overflow past P9 must be rejected."""
    sid = list(ctx.sessions.keys())[0]
    s_obj = ctx.sessions[sid]

    # start at period 9 with duration > 1, or start at period 10
    res1 = check_candidate_move(ctx, base_assign, sid, "MON", 10, "CR-101")
    assert not res1["ok"]
    assert any(v["code"] == "H9" for v in res1["hard_violations"])

    if s_obj.duration >= 2:
        res2 = check_candidate_move(ctx, base_assign, sid, "MON", 9, "CR-101")
        assert not res2["ok"]
        assert any(v["code"] == "H9" for v in res2["hard_violations"])


def test_actor_ownership_authorization(ctx, base_assign):
    """Faculty cannot move another faculty member's session (AUTH_NOT_OWNER)."""
    # Find session belonging to F01
    s_f01 = next(sid for sid, s in ctx.sessions.items() if s.faculty_id == "F01")

    # Faculty F06 attempts to act on F01's session
    actor_f06 = {"role": "faculty", "faculty_id": "F06"}
    res = check_candidate_move(ctx, base_assign, s_f01, "MON", 1, "CR-101", actor=actor_f06)
    assert not res["ok"]
    assert any(v["code"] == "AUTH_NOT_OWNER" for v in res["hard_violations"])


# -------------------------------------------------------------
# 2. SOFT RULES & 50-MOVE PARITY TEST
# -------------------------------------------------------------

def test_soft_rules_breakdown_and_delta(ctx, base_assign):
    """Soft penalties breakdown contains all S1..S6 with integer deltas."""
    sid = list(ctx.sessions.keys())[0]
    cur_d, cur_st, cur_r = base_assign[sid]
    res = check_candidate_move(ctx, base_assign, sid, cur_d, cur_st, cur_r)
    # Moving to current slot must have soft delta 0
    assert res["soft_penalty_delta"] == 0
    for k in ("S1", "S2", "S3", "S4", "S5", "S6"):
        assert k in res["soft_breakdown"]
        assert res["soft_breakdown"][k] == 0


def test_fifty_candidate_moves_parity(ctx, base_assign):
    """
    50-move parity test:
    Validates that check_candidate_move["ok"] is TRUE if and only if
    validate_full_timetable produces 0 hard violations on the updated timetable.
    """
    import random
    rng = random.Random(42)

    sessions = list(ctx.sessions.keys())
    rooms = list(ctx.rooms.keys())
    days = list(ctx.days)

    tested = 0
    for _ in range(50):
        sid = rng.choice(sessions)
        day = rng.choice(days)
        start = rng.randint(1, 9)
        room = rng.choice(rooms)

        # Run candidate check
        cand_res = check_candidate_move(ctx, base_assign, sid, day, start, room)

        # Build full assign and run full validator
        sim_assign = dict(base_assign)
        sim_assign[sid] = (day, start, room)
        full_violations, _ = validate_full_timetable(ctx, sim_assign, "test_parity")

        cand_ok = cand_res["ok"]
        full_ok = (len(full_violations) == 0)

        # Compare parity
        assert cand_ok == full_ok, (
            f"Parity mismatch for {sid} -> ({day}, {start}, {room}): "
            f"cand_ok={cand_ok} (hv={cand_res['hard_violations']}), full_ok={full_ok} (fv={full_violations})"
        )
        tested += 1

    assert tested == 50


# -------------------------------------------------------------
# 3. ENUMERATION & INFEASIBLE EXPLANATION
# -------------------------------------------------------------

def test_enumerate_legal_options(ctx, base_assign):
    """enumerate_legal_options returns ranked zero-violation alternatives."""
    sid = list(ctx.sessions.keys())[0]
    alts = enumerate_legal_options(ctx, base_assign, sid, limit=3)
    assert isinstance(alts, list)
    for opt in alts:
        assert opt["hard_violations_count"] == 0
        assert "soft_penalty_delta" in opt
        assert "room_name" in opt


def test_explain_infeasible_diagnostics(ctx, base_assign):
    """explain_infeasible gives structured failure bottleneck diagnostics."""
    # Test with fixed slot session
    fixed_sid = next((sid for sid, s in ctx.sessions.items() if s.fixed_slot), None)
    if fixed_sid:
        diag = explain_infeasible(ctx, base_assign, fixed_sid)
        assert diag["status"] == "FIXED_SLOT_IMMUTABLE"
        assert len(diag["bottlenecks"]) > 0


# -------------------------------------------------------------
# 4. OFFICIAL VALIDATOR BASELINE CHECK
# -------------------------------------------------------------

def test_official_validator_zero_violations(dataset, active_schedule):
    """The active exports/schedule.json must strictly pass validator.py with 0 hard violations."""
    report = official_validator_run(dataset, active_schedule)
    assert report["hard_violation_count"] == 0, f"Validator reported hard violations: {report['hard_violations']}"
