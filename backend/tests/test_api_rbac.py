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

    # Also verify alias club@cit.edu
    response2 = client.post("/api/auth/login", json={
        "email": "club@cit.edu",
        "password": "Club@123"
    })
    assert response2.status_code == 200
    assert response2.json()["user"]["role"] == "club"


def test_rbac_club_cannot_generate_schedule():
    # Club logs in
    login_res = client.post("/api/auth/login", json={
        "email": "club@cit.edu",
        "password": "Club@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Club attempts to trigger timetable generation
    res = client.post("/api/schedule/generate", headers=headers)
    assert res.status_code == 403


def test_rbac_club_cannot_view_faculty_timetable():
    # Club logs in
    login_res = client.post("/api/auth/login", json={
        "email": "club@cit.edu",
        "password": "Club@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Club attempts to view faculty or group timetable
    res = client.get("/api/schedule?view=faculty&id=F06", headers=headers)
    assert res.status_code == 403
    res2 = client.get("/api/schedule?view=group&id=Y1-A", headers=headers)
    assert res2.status_code == 403


def test_rooms_availability_endpoint():
    # Public or authenticated availability matrix
    res = client.get("/api/rooms/availability?week=7")
    assert res.status_code == 200
    data = res.json()
    assert "rooms" in data
    assert "periods" in data


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

