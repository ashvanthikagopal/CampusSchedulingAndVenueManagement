"""
API & RBAC Unit Tests.
Verifies JWT authentication, role restrictions, and Anti-self-approval enforcement.
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_auth_demo_admin_login():
    response = client.post("/api/auth/login", json={
        "email": "admin@cit.edu",
        "password": "Admin@123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "admin"


def test_auth_demo_coordinator_login():
    response = client.post("/api/auth/login", json={
        "email": "coord_cse@cit.edu",
        "password": "Coord@123"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["role"] == "department_coordinator"


def test_auth_demo_faculty_login():
    response = client.post("/api/auth/login", json={
        "email": "faculty_f06@cit.edu",
        "password": "Faculty@123"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["role"] == "faculty"


def test_auth_demo_club_login():
    response = client.post("/api/auth/login", json={
        "email": "club_dance@cit.edu",
        "password": "Club@123"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["role"] == "club"


def test_rbac_club_cannot_generate_schedule():
    # Club logs in
    login_res = client.post("/api/auth/login", json={
        "email": "club_dance@cit.edu",
        "password": "Club@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Club attempts to trigger timetable generation
    res = client.post("/api/schedule/generate", headers=headers)
    assert res.status_code == 403


def test_rbac_faculty_cannot_approve_proposal():
    # Faculty logs in
    login_res = client.post("/api/auth/login", json={
        "email": "faculty_f06@cit.edu",
        "password": "Faculty@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Faculty attempts to approve a change proposal
    res = client.post("/api/disruptions/proposals/prop_test/approve", headers=headers)
    assert res.status_code == 403


def test_dashboard_endpoint():
    res = client.get("/api/admin/dashboard")
    assert res.status_code == 200
    data = res.json()
    assert data["sessions_scheduled"] == 189
    assert data["hard_conflicts"] == 0


def test_auth_demo_student_login():
    response = client.post("/api/auth/login", json={
        "email": "student_y1a@cit.edu",
        "password": "Student@123"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["role"] == "student"
    assert data["user"]["group_id"] == "Y1-A"
    assert data["user"]["group"] == "Y1-A"


def test_schedule_groups_endpoint():
    res = client.get("/api/schedule/groups")
    assert res.status_code == 200
    groups = res.json()
    assert len(groups) == 14
    group_ids = [g["id"] for g in groups]
    assert "Y1-A" in group_ids
    assert "CSE-3" in group_ids


def test_schedule_view_group_filter_y1a():
    res = client.get("/api/schedule?view=group&id=Y1-A")
    assert res.status_code == 200
    data = res.json()
    sessions = data["sessions"]
    assert len(sessions) > 0
    # Every session returned must belong to Y1-A
    for s in sessions:
        assert "Y1-A" in s["groups"]


def test_schedule_view_group_filter_cse3_elective_basket():
    res = client.get("/api/schedule?view=group&id=CSE-3")
    assert res.status_code == 200
    data = res.json()
    sessions = data["sessions"]
    assert len(sessions) == 19
    # Verify elective basket sessions are present
    basket_sessions = [s for s in sessions if s.get("basket_slot")]
    assert len(basket_sessions) >= 3


def test_rbac_student_cannot_move_session():
    # Student logs in
    login_res = client.post("/api/auth/login", json={
        "email": "student_y1a@cit.edu",
        "password": "Student@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Student attempts to move a session
    res = client.post("/api/schedule/move", json={
        "session_id": "CS101-A-L1",
        "target_day": "WED",
        "target_start_period": 3,
        "target_room_id": "CR-101"
    }, headers=headers)
    assert res.status_code == 403


