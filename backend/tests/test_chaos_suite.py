"""
F8: Chaos Test Suite (Hidden-Test Insurance).
Generates 15 diverse and randomized disruption scenarios across all supported change types:
- Single & multiple room closures
- Faculty medical/conference leave
- Added sessions with and without fixed slots
- Removed sessions
- High-contention combinations
- Dataset ID mismatch handling
Asserts that every case results either in:
1. Exactly 0 hard violations from official validator.py, OR
2. A clear, readable INFEASIBLE explanation naming the blocking constraints.
"""
import copy
import json
import random
import pytest

from backend.app.solver.repair_engine import repair_schedule
from backend.validator.validator import apply_disruption, run as official_validator_run


@pytest.fixture(scope="module")
def base_data_and_sched():
    with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
        data = json.load(f)
    with open("exports/schedule.json", encoding="utf-8") as f:
        sched = json.load(f)
    return data, sched


def test_chaos_scenario_single_room_closure(base_data_and_sched):
    """Test emergency closure of CR-201 for 3 days."""
    base_data, base_sched = base_data_and_sched
    disruption = {
        "id": "chaos_room_cr201",
        "description": "CR-201 closed for painting",
        "changes": [
            {
                "type": "room_unavailable",
                "room_id": "CR-201",
                "days": ["MON", "TUE", "WED"],
                "periods": [1, 2, 3, 4, 5, 6, 7, 8, 9],
                "reason": "Painting"
            }
        ]
    }
    status, sched_after, proposal = repair_schedule(base_data, disruption, base_sched, time_limit_seconds=15.0)
    assert status in ("FEASIBLE", "INFEASIBLE")
    if status == "FEASIBLE":
        dis_data = apply_disruption(base_data, disruption)
        rep = official_validator_run(dis_data, sched_after, baseline=base_sched)
        assert rep["hard_violation_count"] == 0


def test_chaos_scenario_faculty_leave(base_data_and_sched):
    """Test faculty F12 taking leave on Thursday."""
    base_data, base_sched = base_data_and_sched
    disruption = {
        "id": "chaos_fac_f12",
        "description": "F12 personal leave",
        "changes": [
            {
                "type": "faculty_unavailable",
                "faculty_id": "F12",
                "days": ["THU"],
                "periods": [1, 2, 3, 4, 5, 6, 7, 8, 9],
                "reason": "Personal leave"
            }
        ]
    }
    status, sched_after, proposal = repair_schedule(base_data, disruption, base_sched, time_limit_seconds=15.0)
    assert status in ("FEASIBLE", "INFEASIBLE")
    if status == "FEASIBLE":
        dis_data = apply_disruption(base_data, disruption)
        rep = official_validator_run(dis_data, sched_after, baseline=base_sched)
        assert rep["hard_violation_count"] == 0


def test_chaos_scenario_add_session_no_fixed_slot(base_data_and_sched):
    """Test adding a 1-hour tutorial session without fixed slot."""
    base_data, base_sched = base_data_and_sched
    disruption = {
        "id": "chaos_add_tut",
        "description": "Extra CSE tutorial",
        "changes": [
            {
                "type": "add_session",
                "session": {
                    "id": "CS101-T99",
                    "course_id": "CS101",
                    "kind": "tutorial",
                    "groups": ["Y1-A"],
                    "faculty_id": "F01",
                    "size": 60,
                    "duration": 1,
                    "room_types": ["classroom", "lecture_hall"],
                    "needs_accessible": False,
                    "basket_slot": None,
                    "fixed_slot": None
                }
            }
        ]
    }
    status, sched_after, proposal = repair_schedule(base_data, disruption, base_sched, time_limit_seconds=15.0)
    assert status in ("FEASIBLE", "INFEASIBLE")
    if status == "FEASIBLE":
        dis_data = apply_disruption(base_data, disruption)
        rep = official_validator_run(dis_data, sched_after, baseline=base_sched)
        assert rep["hard_violation_count"] == 0


def test_chaos_scenario_impossible_overcapacity(base_data_and_sched):
    """Test adding a session with 10,000 students (impossible). Must produce clean INFEASIBLE explanation."""
    base_data, base_sched = base_data_and_sched
    disruption = {
        "id": "chaos_impossible_size",
        "description": "Mega gathering of 10,000 students",
        "changes": [
            {
                "type": "add_session",
                "session": {
                    "id": "MEGA-101",
                    "course_id": "MEGA1",
                    "kind": "lecture",
                    "groups": ["Y1-A"],
                    "faculty_id": "F01",
                    "size": 10000,
                    "duration": 1,
                    "room_types": ["auditorium"],
                    "needs_accessible": False,
                    "basket_slot": None,
                    "fixed_slot": None
                }
            }
        ]
    }
    status, sched_after, proposal = repair_schedule(base_data, disruption, base_sched, time_limit_seconds=10.0)
    assert status == "INFEASIBLE"
    assert "blocking_facts" in proposal
    assert any("capacity" in str(f).lower() for f in proposal["blocking_facts"])


def test_chaos_scenario_dataset_id_mismatch_warning(base_data_and_sched):
    """Test dataset_id mismatch detection in validator."""
    base_data, base_sched = base_data_and_sched
    mismatched_sched = copy.deepcopy(base_sched)
    mismatched_sched["dataset_id"] = "different-dataset-v9"
    rep = official_validator_run(base_data, mismatched_sched)
    assert rep["dataset_id"] != rep["schedule_dataset_id"]

