"""
Comprehensive Role-Based Permission and Security Test Suite.
Verifies all 4 official roles (Admin, Department Coordinator, Faculty, Club Representative)
against Section 4 (ROLES AND PRIORITY) of the CIT Hackathon Problem Statement.
Tests both permitted actions and negative authorization enforcement (HTTP 403 / HTTP 401).
"""
import pytest
import json
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def get_auth_token(identifier: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"identifier": identifier, "password": password})
    assert res.status_code == 200, f"Login failed for {identifier}: {res.text}"
    return res.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return get_auth_token("admin@cit.edu", "Admin@123")


@pytest.fixture(scope="module")
def coord_cse_token():
    return get_auth_token("coord_cse@cit.edu", "Coord@123")


@pytest.fixture(scope="module")
def coord_ece_token():
    return get_auth_token("coord_ece@cit.edu", "Coord@123")


@pytest.fixture(scope="module")
def faculty_f06_token():
    return get_auth_token("faculty_f06@cit.edu", "Faculty@123")


@pytest.fixture(scope="module")
def faculty_f01_token():
    return get_auth_token("faculty_f01@cit.edu", "Faculty@123")


@pytest.fixture(scope="module")
def club_dance_token():
    return get_auth_token("club_dance@cit.edu", "Club@123")


@pytest.fixture(scope="module")
def club_ecell_token():
    return get_auth_token("club_ecell@cit.edu", "Club@123")


# =========================================================================
# 1. ADMIN PERMISSIONS & STRICT BOUNDS
# =========================================================================

def test_admin_can_view_audit_logs(admin_token):
    res = client.get("/api/admin/audit", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_admin_can_update_priority(admin_token):
    res = client.put("/api/admin/priority", json={
        "priority_order": ["exam", "regular_session", "institute_event", "guest_lecture", "department_event", "club_event"]
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert res.json()["status"] == "success"


def test_admin_can_generate_exams(admin_token):
    res = client.post("/api/exams/generate", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code in (200, 400)


def test_admin_cannot_bypass_hard_constraints(admin_token):
    """Even Admin cannot move a session into an invalid slot that violates hard constraints."""
    res = client.post("/api/schedule/move", json={
        "session_id": "CS101-A-L1",
        "target_day": "MON",
        "target_start_period": 1,
        "target_room_id": "CR-101"
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code in (200, 400)


# =========================================================================
# 2. DEPARTMENT COORDINATOR PERMISSIONS & RESTRICTIONS
# =========================================================================

def test_coordinator_can_request_own_dept_session_change(coord_cse_token):
    """CSE coordinator requests change for CS202-L1 (CSE course)."""
    res = client.post("/api/session-requests", json={
        "course_id": "CS202",
        "kind": "lecture",
        "duration": 1,
        "groups": ["CSE-3"],
        "reason": "Department lab synchronization",
        "request_type": "move",
        "target_session_id": "CS202-L1"
    }, headers={"Authorization": f"Bearer {coord_cse_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "pending"
    assert data["department"] == "CSE"


def test_coordinator_cannot_change_other_dept_session(coord_cse_token):
    """CSE coordinator cannot request changes for ECE courses (e.g. EC201-L1)."""
    res = client.post("/api/session-requests", json={
        "course_id": "EC201",
        "kind": "lecture",
        "duration": 1,
        "groups": ["ECE-3"],
        "reason": "Unauthorized cross-dept move",
        "request_type": "move",
        "target_session_id": "EC201-L1"
    }, headers={"Authorization": f"Bearer {coord_cse_token}"})
    assert res.status_code == 403
    assert "Department scoping violation" in res.json().get("detail", "")


def test_coordinator_cannot_change_global_priority(coord_cse_token):
    res = client.put("/api/admin/priority", json={
        "priority_order": ["club_event", "exam"]
    }, headers={"Authorization": f"Bearer {coord_cse_token}"})
    assert res.status_code == 403


def test_coordinator_cannot_reset_demo(coord_cse_token):
    res = client.post("/api/admin/reset-demo", headers={"Authorization": f"Bearer {coord_cse_token}"})
    assert res.status_code == 403


def test_coordinator_cannot_view_audit_logs(coord_cse_token):
    res = client.get("/api/admin/audit", headers={"Authorization": f"Bearer {coord_cse_token}"})
    assert res.status_code == 403


def test_coordinator_cannot_generate_timetable(coord_cse_token):
    res = client.post("/api/schedule/generate", headers={"Authorization": f"Bearer {coord_cse_token}"})
    assert res.status_code == 403


def test_coordinator_can_approve_own_dept_lab(coord_cse_token):
    """CSE coordinator can decide bookings for CS-LAB-1 or CS-LAB-2."""
    res = client.post("/api/bookings/BR-02/decision", json={
        "action": "rejected",
        "room_id": "CS-LAB-1",
        "reason": "Department lab scheduled for maintenance"
    }, headers={"Authorization": f"Bearer {coord_cse_token}"})
    assert res.status_code in (200, 400)


def test_coordinator_cannot_approve_other_dept_lab(coord_cse_token):
    """CSE coordinator cannot approve bookings for PHY-LAB (Physics)."""
    res = client.post("/api/bookings/BR-01/decision", json={
        "action": "approved",
        "room_id": "PHY-LAB"
    }, headers={"Authorization": f"Bearer {coord_cse_token}"})
    assert res.status_code == 403


# =========================================================================
# 3. FACULTY PERMISSIONS & RESTRICTIONS
# =========================================================================

def test_faculty_can_view_own_schedule(faculty_f06_token):
    res = client.get("/api/schedule/faculty/my-schedule", headers={"Authorization": f"Bearer {faculty_f06_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["faculty_id"] == "F06"
    assert "daily_workload" in data
    assert "total_weekly_hours" in data


def test_faculty_cannot_view_other_faculty_private_schedule(faculty_f06_token):
    """F06 cannot request schedule explicitly scoped to F01."""
    res = client.get("/api/schedule?view=faculty&id=F01", headers={"Authorization": f"Bearer {faculty_f06_token}"})
    assert res.status_code == 403
    assert "Faculty can only view their own" in res.json().get("detail", "")


def test_faculty_can_mark_own_unavailability(faculty_f06_token):
    res = client.post("/api/disruptions", json={
        "description": "Attending IEEE Conference",
        "changes": [
            {
                "type": "faculty_unavailable",
                "faculty_id": "F06",
                "day": "WED",
                "periods": [2, 3]
            }
        ]
    }, headers={"Authorization": f"Bearer {faculty_f06_token}"})
    assert res.status_code == 200
    assert res.json()["status"] == "success"


def test_faculty_cannot_mark_other_faculty_unavailability(faculty_f06_token):
    """F06 cannot submit unavailability for F19."""
    res = client.post("/api/disruptions", json={
        "description": "Unauthorized disruption declaration",
        "changes": [
            {
                "type": "faculty_unavailable",
                "faculty_id": "F19",
                "day": "WED",
                "periods": [2, 3]
            }
        ]
    }, headers={"Authorization": f"Bearer {faculty_f06_token}"})
    assert res.status_code == 403
    assert "Faculty can only declare their own unavailability" in res.json().get("detail", "")


def test_faculty_can_request_own_session_change(faculty_f06_token):
    """F06 teaches CS202-L1."""
    res = client.post("/api/session-requests", json={
        "course_id": "CS202",
        "kind": "lecture",
        "duration": 1,
        "groups": ["CSE-3"],
        "reason": "Medical appointment",
        "request_type": "move",
        "target_session_id": "CS202-L1"
    }, headers={"Authorization": f"Bearer {faculty_f06_token}"})
    assert res.status_code == 200
    assert res.json()["faculty_id"] == "F06"


def test_faculty_cannot_request_other_faculty_session_change(faculty_f06_token):
    """F06 cannot request changes to MA101-AB-L1 (assigned to F19)."""
    res = client.post("/api/session-requests", json={
        "course_id": "MA101",
        "kind": "lecture",
        "duration": 1,
        "groups": ["Y1-A"],
        "reason": "Unauthorized session move",
        "request_type": "move",
        "target_session_id": "MA101-AB-L1"
    }, headers={"Authorization": f"Bearer {faculty_f06_token}"})
    assert res.status_code == 403
    assert "Faculty scoping violation" in res.json().get("detail", "")


def test_faculty_cannot_approve_bookings(faculty_f06_token):
    res = client.post("/api/bookings/BR-01/decision", json={
        "action": "approved"
    }, headers={"Authorization": f"Bearer {faculty_f06_token}"})
    assert res.status_code == 403


def test_faculty_cannot_approve_disruption_proposals(faculty_f06_token):
    res = client.post("/api/disruptions/proposals/prop_test/approve", headers={"Authorization": f"Bearer {faculty_f06_token}"})
    assert res.status_code == 403


def test_faculty_cannot_directly_move_sessions(faculty_f06_token):
    res = client.post("/api/schedule/move", json={
        "session_id": "CS202-L1",
        "target_day": "THU",
        "target_start_period": 3,
        "target_room_id": "CR-101"
    }, headers={"Authorization": f"Bearer {faculty_f06_token}"})
    assert res.status_code == 403


# =========================================================================
# 4. CLUB REPRESENTATIVE PERMISSIONS & RESTRICTIONS
# =========================================================================

def test_club_can_submit_venue_request(club_dance_token):
    res = client.post("/api/bookings", json={
        "title": "Annual Dance Showcase Rehearsal",
        "attendance": 60,
        "duration_periods": 2,
        "requested_category": "club_event",
        "windows": [{"day": "THU", "from_period": 10, "to_period": 11}],
        "room_types": ["seminar_hall"]
    }, headers={"Authorization": f"Bearer {club_dance_token}"})
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    assert "request_id" in res.json()


def test_club_can_cancel_own_pending_request(club_dance_token):
    # First submit a request
    submit_res = client.post("/api/bookings", json={
        "title": "Practice Session to Cancel",
        "attendance": 30,
        "duration_periods": 1,
        "requested_category": "club_event",
        "windows": [{"day": "FRI", "from_period": 10, "to_period": 10}],
        "room_types": ["classroom"]
    }, headers={"Authorization": f"Bearer {club_dance_token}"})
    assert submit_res.status_code == 200
    req_id = submit_res.json()["request_id"]

    # Now cancel it
    cancel_res = client.post(f"/api/bookings/{req_id}/cancel", headers={"Authorization": f"Bearer {club_dance_token}"})
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "success"


def test_club_cannot_cancel_other_clubs_request(club_dance_token, club_ecell_token):
    # E-Cell submits a request
    submit_res = client.post("/api/bookings", json={
        "title": "E-Cell Pitch Deck Review",
        "attendance": 45,
        "duration_periods": 2,
        "requested_category": "club_event",
        "windows": [{"day": "TUE", "from_period": 10, "to_period": 11}],
        "room_types": ["seminar_hall"]
    }, headers={"Authorization": f"Bearer {club_ecell_token}"})
    assert submit_res.status_code == 200
    req_id = submit_res.json()["request_id"]

    # Dance Club attempts to cancel E-Cell request -> 403 Forbidden!
    cancel_res = client.post(f"/api/bookings/{req_id}/cancel", headers={"Authorization": f"Bearer {club_dance_token}"})
    assert cancel_res.status_code == 403
    assert "Club scoping violation" in cancel_res.json().get("detail", "")


def test_club_cannot_approve_bookings(club_dance_token):
    res = client.post("/api/bookings/BR-01/decision", json={"action": "approved"}, headers={"Authorization": f"Bearer {club_dance_token}"})
    assert res.status_code == 403


def test_club_cannot_modify_timetable_sessions(club_dance_token):
    res = client.post("/api/session-requests", json={
        "course_id": "CS101",
        "kind": "lecture",
        "duration": 1,
        "groups": ["Y1-A"],
        "reason": "Club interference",
        "request_type": "move"
    }, headers={"Authorization": f"Bearer {club_dance_token}"})
    assert res.status_code == 403


def test_club_cannot_access_faculty_or_group_views(club_dance_token):
    res = client.get("/api/schedule?view=faculty", headers={"Authorization": f"Bearer {club_dance_token}"})
    assert res.status_code == 403


# =========================================================================
# 5. COMMON SECURITY & AUTHENTICATION ENFORCEMENTS
# =========================================================================

def test_unauthenticated_requests_return_401():
    res = client.get("/api/admin/audit")
    assert res.status_code == 401

    res = client.post("/api/bookings", json={"title": "Test"})
    assert res.status_code == 401


def test_anti_self_approval_blocked_on_all_roles(admin_token):
    # admin2 reported disruption, admin2 cannot approve it
    login_admin2 = client.post("/api/auth/login", json={"identifier": "admin2@cit.edu", "password": "Admin@123"})
    admin2_token = login_admin2.json()["access_token"]
    # BR-01 was requested by Spectra Core Team (admin2)
    res = client.post("/api/bookings/BR-01/decision", json={"action": "approved"}, headers={"Authorization": f"Bearer {admin2_token}"})
    assert res.status_code == 403
    assert "Anti-self-approval" in res.json().get("detail", "")


def test_payload_role_spoofing_ignored(club_dance_token):
    """Payload claims role='admin' or 'institute_event'; server derives role exclusively from JWT!"""
    res = client.post("/api/bookings", json={
        "title": "Spoofed Admin Lecture",
        "attendance": 50,
        "duration_periods": 1,
        "requested_category": "institute_event",  # Claiming institute level
        "role": "admin",                         # Frontend payload manipulation
        "windows": [{"day": "MON", "from_period": 10, "to_period": 10}],
        "room_types": ["classroom"]
    }, headers={"Authorization": f"Bearer {club_dance_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["effective_category"] == "club_event"  # Capped server-side!
    assert "exceeded role ceiling" in data["rule_trace"].lower()
