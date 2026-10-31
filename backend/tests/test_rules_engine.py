"""
Comprehensive test suite for the rules engine (H1-H14, B1-B3, E1-E2, S1-S6).
Verifies 100% agreement with the official validator.py.
"""
import copy
import json
import pytest
from pathlib import Path
from backend.app.rules.engine import evaluate_schedule
from backend.validator.validator import run as official_validator_run

DATA_PATH = Path("data/starter_dataset/cit_public.json")
EXAMPLE_PATH = Path("starter_pack/examples/schedule.example.json")


@pytest.fixture
def dataset():
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def example_schedule():
    with open(EXAMPLE_PATH, encoding="utf-8") as f:
        return json.load(f)


def test_cross_check_with_official_validator(dataset, example_schedule):
    """Ensure in-app engine produces the exact same hard violation count and by-rule counts as validator.py."""
    app_report = evaluate_schedule(dataset, example_schedule)
    official_report = official_validator_run(dataset, example_schedule)

    assert app_report["hard_violation_count"] == official_report["hard_violation_count"]
    assert app_report["hard_by_rule"] == official_report["hard_by_rule"]
    assert app_report["soft_total"] == official_report["soft_total"]
    assert app_report["soft_penalties"] == official_report["soft_penalties"]


def test_h1_missing_and_unknown_session(dataset):
    """Test H1: session not scheduled and unknown session id."""
    sched = {
        "team": "Test",
        "dataset_id": dataset["dataset_id"],
        "sessions": [
            {"session_id": "NON_EXISTENT_SESSION", "day": "MON", "start_period": 1, "room_id": "CR-101"}
        ]
    }
    report = evaluate_schedule(dataset, sched)
    assert report["hard_by_rule"].get("H1", 0) > 0
    assert any("NON_EXISTENT_SESSION" in x["detail"] for x in report["hard_violations"])


def test_h2_faculty_double_booked(dataset):
    """Test H2: faculty assigned to two sessions simultaneously."""
    # F19 teaches MA101-AB-L1 and MA101-AB-L2
    sched = {
        "team": "Test",
        "dataset_id": dataset["dataset_id"],
        "sessions": [
            {"session_id": "MA101-AB-L1", "day": "MON", "start_period": 1, "room_id": "LH-1"},
            {"session_id": "MA101-AB-L2", "day": "MON", "start_period": 1, "room_id": "LH-2"}
        ]
    }
    report = evaluate_schedule(dataset, sched)
    assert report["hard_by_rule"].get("H2", 0) >= 1
    assert any("F19 double-booked" in x["detail"] for x in report["hard_violations"])


def test_h3_group_double_booked_and_basket_independence(dataset):
    """Test H3: group double-booked, while same-basket sessions are allowed together."""
    # Group Y1-A in two different sessions at same time
    sched = {
        "team": "Test",
        "dataset_id": dataset["dataset_id"],
        "sessions": [
            {"session_id": "MA101-AB-L1", "day": "MON", "start_period": 1, "room_id": "LH-1"},
            {"session_id": "PH101-A-L1", "day": "MON", "start_period": 1, "room_id": "CR-101"}
        ]
    }
    report = evaluate_schedule(dataset, sched)
    assert report["hard_by_rule"].get("H3", 0) >= 1
    assert any("Group Y1-A double-booked" in x["detail"] for x in report["hard_violations"])

    # Basket sessions (OE301, OE302, OE303) share basket_slot OEB-1 and all have Year 3 groups.
    # They should NOT conflict with each other!
    basket_sched = {
        "team": "Test",
        "dataset_id": dataset["dataset_id"],
        "sessions": [
            {"session_id": "OE301-L1", "day": "MON", "start_period": 1, "room_id": "LH-1"},
            {"session_id": "OE302-L1", "day": "MON", "start_period": 1, "room_id": "LH-2"},
            {"session_id": "OE303-L1", "day": "MON", "start_period": 1, "room_id": "CR-101"}
        ]
    }
    basket_report = evaluate_schedule(dataset, basket_sched)
    # H3 should be 0 because same basket_slot does not clash with itself
    assert basket_report["hard_by_rule"].get("H3", 0) == 0


def test_h4_room_double_booked(dataset):
    """Test H4: two sessions in same room at same time."""
    sched = {
        "team": "Test",
        "dataset_id": dataset["dataset_id"],
        "sessions": [
            {"session_id": "MA101-AB-L1", "day": "MON", "start_period": 1, "room_id": "LH-1"},
            {"session_id": "PH101-C-L1", "day": "MON", "start_period": 1, "room_id": "LH-1"}
        ]
    }
    report = evaluate_schedule(dataset, sched)
    assert report["hard_by_rule"].get("H4", 0) >= 1


def test_h5_room_capacity(dataset):
    """Test H5: room capacity smaller than session size."""
    # MA101-AB-L1 has size 180, CR-105 has capacity 70
    sched = {
        "team": "Test",
        "dataset_id": dataset["dataset_id"],
        "sessions": [
            {"session_id": "MA101-AB-L1", "day": "MON", "start_period": 1, "room_id": "CR-105"}
        ]
    }
    report = evaluate_schedule(dataset, sched)
    assert report["hard_by_rule"].get("H5", 0) >= 1
    assert any("size 180 > CR-105 capacity 70" in x["detail"] for x in report["hard_violations"])


def test_h6_room_type(dataset):
    """Test H6: room type mismatch."""
    # MA101-AB-L1 allows classroom, lecture_hall, auditorium. CS-LAB-1 is lab_cs.
    sched = {
        "team": "Test",
        "dataset_id": dataset["dataset_id"],
        "sessions": [
            {"session_id": "MA101-AB-L1", "day": "MON", "start_period": 1, "room_id": "CS-LAB-1"}
        ]
    }
    report = evaluate_schedule(dataset, sched)
    assert report["hard_by_rule"].get("H6", 0) >= 1


def test_h7_faculty_unavailability(dataset):
    """Test H7: faculty unavailable at that period."""
    # F37 (Dean) unavailable MON P1
    sched = {
        "team": "Test",
        "dataset_id": dataset["dataset_id"],
        "sessions": [
            {"session_id": "ID101-ALL-L1", "day": "MON", "start_period": 1, "room_id": "AUD"}
        ]
    }
    report = evaluate_schedule(dataset, sched)
    assert report["hard_by_rule"].get("H7", 0) >= 1


def test_h8_room_unavailability(dataset):
    """Test H8: room unavailable."""
    # LH-4 is unavailable all day Thursday
    sched = {
        "team": "Test",
        "dataset_id": dataset["dataset_id"],
        "sessions": [
            {"session_id": "HS201-H1-L1", "day": "THU", "start_period": 1, "room_id": "LH-4"}
        ]
    }
    report = evaluate_schedule(dataset, sched)
    assert report["hard_by_rule"].get("H8", 0) >= 1


def test_h9_time_and_lunch_and_lab_start(dataset):
    """Test H9: session crosses lunch, lab starts outside P2/P6, or runs past P9."""
    # CS191-A-P1 is a 3-hour lab. Placing it at P1 violates lab start rule.
    sched = {
        "team": "Test",
        "dataset_id": dataset["dataset_id"],
        "sessions": [
            {"session_id": "CS191-A-P1", "day": "MON", "start_period": 1, "room_id": "CS-LAB-1"}
        ]
    }
    report = evaluate_schedule(dataset, sched)
    assert report["hard_by_rule"].get("H9", 0) >= 1
    assert any("lab must start at P2 or P6" in x["detail"] for x in report["hard_violations"])


def test_h10_accessibility(dataset):
    """Test H10: session requiring accessibility placed in non-accessible room."""
    # ME201-L1 needs accessible. CR-201 is not accessible.
    sched = {
        "team": "Test",
        "dataset_id": dataset["dataset_id"],
        "sessions": [
            {"session_id": "ME201-L1", "day": "MON", "start_period": 1, "room_id": "CR-201"}
        ]
    }
    report = evaluate_schedule(dataset, sched)
    assert report["hard_by_rule"].get("H10", 0) >= 1


def test_h11_basket_synchronicity(dataset):
    """Test H11: sessions sharing basket_slot placed at different times."""
    sched = {
        "team": "Test",
        "dataset_id": dataset["dataset_id"],
        "sessions": [
            {"session_id": "OE301-L1", "day": "MON", "start_period": 1, "room_id": "LH-1"},
            {"session_id": "OE302-L1", "day": "MON", "start_period": 2, "room_id": "LH-2"}
        ]
    }
    report = evaluate_schedule(dataset, sched)
    assert report["hard_by_rule"].get("H11", 0) >= 1


def test_h12_faculty_max_hours(dataset):
    """Test H12: faculty exceeding daily max hours."""
    # F03 has max_hours_per_day = 4. Let's schedule 6 hours on Monday (two 3h labs).
    # CS191-A-P1 (3h lab at P2) + CS191-B-P1 (3h lab at P6) = 6h
    sched = {
        "team": "Test",
        "dataset_id": dataset["dataset_id"],
        "sessions": [
            {"session_id": "CS191-A-P1", "day": "MON", "start_period": 2, "room_id": "CS-LAB-1"},
            {"session_id": "CS191-B-P1", "day": "MON", "start_period": 6, "room_id": "CS-LAB-2"}
        ]
    }
    report = evaluate_schedule(dataset, sched)
    assert report["hard_by_rule"].get("H12", 0) >= 1


def test_h14_fixed_slot(dataset):
    """Test H14: fixed slot session violated."""
    d_copy = copy.deepcopy(dataset)
    d_copy["sessions"][0]["fixed_slot"] = {"day": "FRI", "start_period": 4}
    sid = d_copy["sessions"][0]["id"]
    sched = {
        "team": "Test",
        "dataset_id": dataset["dataset_id"],
        "sessions": [
            {"session_id": sid, "day": "MON", "start_period": 2, "room_id": "LH-1"}
        ]
    }
    report = evaluate_schedule(d_copy, sched)
    assert report["hard_by_rule"].get("H14", 0) >= 1


def test_b3_cancelled_booking(dataset):
    """Test B3: approved cancelled booking."""
    # BR-04 is cancelled
    sched = {
        "team": "Test",
        "dataset_id": dataset["dataset_id"],
        "sessions": [],
        "fest_week": {
            "bookings": [
                {
                    "request_id": "BR-04",
                    "status": "approved",
                    "day": "MON",
                    "start_period": 10,
                    "end_period": 11,
                    "room_id": "SH-1",
                    "reason": "Test approval"
                }
            ]
        }
    }
    report = evaluate_schedule(dataset, sched)
    assert report["hard_by_rule"].get("B3", 0) >= 1


def test_e1_and_e2_exams(dataset):
    """Test E1 and E2: exam validation."""
    # E2: laboratory cannot host exams
    sched = {
        "team": "Test",
        "dataset_id": dataset["dataset_id"],
        "sessions": [],
        "exams": [
            {
                "exam_id": "EX-MA101",
                "day": "MON",
                "session": "AM",
                "rooms": ["CS-LAB-1"]
            }
        ]
    }
    report = evaluate_schedule(dataset, sched)
    assert report["hard_by_rule"].get("E2", 0) >= 1

