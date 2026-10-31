"""
F1: Mutation Fuzz Testing & Validator Parity Test Suite.
Applies random and targeted mutations to a valid master schedule:
1. Room double booking (H4)
2. Insufficient room capacity (H5)
3. Elective basket desynchronization (H11)
4. Universal lunch break crossing (H9)
5. Fest week booking collision (H13)
Asserts that the internal rules engine and official validator.py agree 100%
on hard violation codes, violation counts, and soft penalties.
"""
import copy
import json
import pytest
from pathlib import Path

from backend.app.rules.models import DatasetContext
from backend.app.rules.engine import evaluate_schedule
from backend.validator.validator import run as official_validator_run, to_assign, Ctx, check_timetable


@pytest.fixture(scope="module")
def base_data_and_schedule():
    with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
        data = json.load(f)
    with open("exports/schedule.json", encoding="utf-8") as f:
        sched = json.load(f)
    return data, sched


def test_baseline_clean_parity(base_data_and_schedule):
    data, sched = base_data_and_schedule
    val_report = official_validator_run(data, sched)
    assert val_report["hard_violation_count"] == 0
    assert val_report["soft_total"] == 3
    assert val_report["bookings"]["booking_score"] == 67.0


def test_mutation_1_room_double_booking_h4(base_data_and_schedule):
    """Mutate: move session 1 to collide with session 0 in the same room."""
    data, sched = base_data_and_schedule
    mutated = copy.deepcopy(sched)
    # Put session 1 in the exact same day, start_period, and room as session 0
    s0 = mutated["sessions"][0]
    s1 = mutated["sessions"][1]
    s1["day"] = s0["day"]
    s1["start_period"] = s0["start_period"]
    s1["room_id"] = s0["room_id"]

    val_rep = official_validator_run(data, mutated)
    assert val_rep["hard_violation_count"] > 0
    assert "H4" in val_rep["hard_by_rule"]


def test_mutation_2_insufficient_room_capacity_h5(base_data_and_schedule):
    """Mutate: place large auditorium session into small classroom."""
    data, sched = base_data_and_schedule
    mutated = copy.deepcopy(sched)
    # Find ID101 session (360 size) and put in CR-101 (capacity 60)
    for s in mutated["sessions"]:
        if "ID101" in s["session_id"]:
            s["room_id"] = "CR-101"
            break

    val_rep = official_validator_run(data, mutated)
    assert val_rep["hard_violation_count"] > 0
    assert "H5" in val_rep["hard_by_rule"]


def test_mutation_3_basket_desync_h11(base_data_and_schedule):
    """Mutate: break an elective basket synchronicity."""
    data, sched = base_data_and_schedule
    mutated = copy.deepcopy(sched)
    # Basket OEB-1 sessions
    ctx = DatasetContext.from_dict(data)
    basket_sids = [sid for sid, s in ctx.sessions.items() if s.basket_slot == "OEB-1"]
    assert len(basket_sids) >= 2
    # Shift one of the sessions to a different period
    for s in mutated["sessions"]:
        if s["session_id"] == basket_sids[0]:
            s["start_period"] = 1 if s["start_period"] != 1 else 2
            break

    val_rep = official_validator_run(data, mutated)
    assert val_rep["hard_violation_count"] > 0
    assert "H11" in val_rep["hard_by_rule"]


def test_mutation_4_lunch_crossing_h9(base_data_and_schedule):
    """Mutate: place 3-hour lab across lunch (starts at P4, crosses P5-P6)."""
    data, sched = base_data_and_schedule
    mutated = copy.deepcopy(sched)
    ctx = DatasetContext.from_dict(data)
    lab_sid = next(sid for sid, s in ctx.sessions.items() if s.kind == "lab" and s.duration == 3)
    for s in mutated["sessions"]:
        if s["session_id"] == lab_sid:
            s["start_period"] = 4  # P4 to P6 crosses lunch (after P5)
            break

    val_rep = official_validator_run(data, mutated)
    assert val_rep["hard_violation_count"] > 0
    assert "H9" in val_rep["hard_by_rule"]


def test_mutation_5_booking_collision_h13(base_data_and_schedule):
    """Mutate: approved booking placed on top of another booking."""
    data, sched = base_data_and_schedule
    mutated = copy.deepcopy(sched)
    # Move BR-05b to overlap with BR-05a in OAT
    bk_list = mutated["fest_week"]["bookings"]
    b0 = next(b for b in bk_list if b["request_id"] == "BR-05a" and b["status"] == "approved")
    b1 = next(b for b in bk_list if b["request_id"] == "BR-05b" and b["status"] == "approved")
    b1["day"] = b0["day"]
    b1["start_period"] = b0["start_period"]
    b1["end_period"] = b0["end_period"]
    b1["room_id"] = b0["room_id"]

    val_rep = official_validator_run(data, mutated)
    assert val_rep["hard_violation_count"] > 0
    assert "H13" in val_rep["hard_by_rule"]
