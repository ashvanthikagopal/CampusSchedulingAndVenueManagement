"""
API & RBAC Unit Tests.
Verifies dynamic 62 dataset-driven accounts, JWT authentication,
scoping enforcement, anti-self-approval, and reset idempotency.
"""
import pytest
import json
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.session import SessionLocal
from backend.app.core.seed_users import seed_users

client = TestClient(app)

# Ensure database is seeded before collecting accounts
ROLE_PASSWORDS = {
    "admin": "Admin@123",
    "department_coordinator": "Coord@123",
    "faculty": "Faculty@123",
    "club": "Club@123",
}

_db = SessionLocal()
_ALL_USERS = seed_users(_db)
ACCOUNT_TEST_CASES = [
    {
        "email": u.email,
        "password": ROLE_PASSWORDS[u.role],
        "expected_role": u.role,
        "expected_dept": u.department,
        "expected_faculty_id": u.faculty_id,
        "expected_club_name": u.club_name,
    }
    for u in _ALL_USERS
]
_db.close()


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_public_stats_endpoint():
    response = client.get("/api/public/stats")
    assert response.status_code == 200
    data = response.json()
    assert "sessions_scheduled" in data
    assert "hard_violations" in data
    assert "booking_score" in data
    assert "bookings_count" in data
    assert "last_reschedule_moved_count" in data
    assert data["hard_violations"] == 0
    assert data["sessions_scheduled"] >= 180


def test_auth_directory_endpoint():
    response = client.get("/api/auth/directory")
    assert response.status_code == 200
    data = response.json()
    assert len(data["admins"]) == 2
    assert len(data["coordinators"]) == 9
    assert len(data["faculty"]) == 40
    assert len(data["clubs"]) == 11
    assert data["role_passwords_hint"] is False
    # Ensure no passwords are leaked
    for cat in ["admins", "coordinators", "faculty", "clubs"]:
        for item in data[cat]:
            assert "password" not in item
            assert "password_hash" not in item


@pytest.mark.parametrize("acc", ACCOUNT_TEST_CASES)
def test_all_62_accounts_login(acc):
    """Parametrized verification of EVERY single account out of all 62 dataset accounts."""
    response = client.post("/api/auth/login", json={
        "identifier": acc["email"],
        "password": acc["password"]
    })
    assert response.status_code == 200, f"Login failed for {acc['email']}: {response.text}"
    data = response.json()
    assert "access_token" in data
    u = data["user"]
    assert u["role"] == acc["expected_role"]
    assert u["email"] == acc["email"]

    if acc["expected_dept"] is not None:
        assert u["department"] == acc["expected_dept"]

    if acc["expected_faculty_id"] is not None:
        assert u["faculty_id"] == acc["expected_faculty_id"]

    if acc["expected_club_name"] is not None:
        assert u["club_name"] == acc["expected_club_name"]


def test_faculty_id_as_identifier_login():
    """Faculty can log in using their Faculty ID (e.g. 'F06' or 'f06')."""
    res1 = client.post("/api/auth/login", json={
        "identifier": "F06",
        "password": "Faculty@123"
    })
    assert res1.status_code == 200
    assert res1.json()["user"]["faculty_id"] == "F06"

    res2 = client.post("/api/auth/login", json={
        "identifier": "f06",
        "password": "Faculty@123"
    })
    assert res2.status_code == 200
    assert res2.json()["user"]["faculty_id"] == "F06"


def test_rbac_club_cannot_approve_bookings():
    # Dance Club logs in
    login_res = client.post("/api/auth/login", json={
        "identifier": "club_dance@cit.edu",
        "password": "Club@123"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt to approve a booking request
    res = client.post("/api/bookings/BR-01/decision", json={"action": "approved"}, headers=headers)
    assert res.status_code == 403


def test_rbac_club_cannot_generate_schedule():
    login_res = client.post("/api/auth/login", json={
        "identifier": "club_coding@cit.edu",
        "password": "Club@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/schedule/generate", headers=headers)
    assert res.status_code == 403


def test_rbac_faculty_cannot_move_or_generate_schedule():
    login_res = client.post("/api/auth/login", json={
        "identifier": "faculty_f06@cit.edu",
        "password": "Faculty@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Cannot generate timetable
    res_gen = client.post("/api/schedule/generate", headers=headers)
    assert res_gen.status_code == 403

    # Cannot directly move session
    res_move = client.post("/api/schedule/move", json={
        "session_id": "CS101-A-L1",
        "target_day": "MON",
        "target_start_period": 1,
        "target_room_id": "LH-1"
    }, headers=headers)
    assert res_move.status_code == 403


def test_faculty_scoped_timetable_view():
    login_res = client.post("/api/auth/login", json={
        "identifier": "faculty_f06@cit.edu",
        "password": "Faculty@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Can view own faculty timetable
    res_own = client.get("/api/schedule?view=faculty&id=F06", headers=headers)
    assert res_own.status_code == 200

    # Cannot view another faculty member's timetable
    res_other = client.get("/api/schedule?view=faculty&id=F01", headers=headers)
    assert res_other.status_code == 403

    # Cannot view group timetable
    res_grp = client.get("/api/schedule?view=group&id=Y1-A", headers=headers)
    assert res_grp.status_code == 403


def test_coordinator_cannot_touch_another_department():
    # CSE Coordinator logs in
    login_res = client.post("/api/auth/login", json={
        "identifier": "coord_cse@cit.edu",
        "password": "Coord@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt to move a session belonging to Civil Engineering (CE)
    res = client.post("/api/schedule/move", json={
        "session_id": "CE201-L1",
        "target_day": "MON",
        "target_start_period": 1,
        "target_room_id": "CR-101"
    }, headers=headers)
    assert res.status_code == 403

    # Attempt to approve a booking for PHY-LAB (Physics department)
    res_lab = client.post("/api/bookings/BR-01/decision", json={
        "action": "approved",
        "room_id": "PHY-LAB"
    }, headers=headers)
    assert res_lab.status_code == 403


def test_anti_self_approval_admin():
    # admin2@cit.edu is "Spectra Core Team"
    login_res = client.post("/api/auth/login", json={
        "identifier": "admin2@cit.edu",
        "password": "Admin@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # BR-01 was requested by "Spectra Core Team" -> anti-self-approval blocks admin2!
    res = client.post("/api/bookings/BR-01/decision", json={"action": "approved"}, headers=headers)
    assert res.status_code == 403
    assert "Anti-self-approval" in res.json().get("detail", "")

    # admin@cit.edu is "Dean's Office" -> can decide BR-01
    login_res_admin1 = client.post("/api/auth/login", json={
        "identifier": "admin@cit.edu",
        "password": "Admin@123"
    })
    token1 = login_res_admin1.json()["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}
    res_admin1 = client.post("/api/bookings/BR-01/decision", json={"action": "approved"}, headers=headers1)
    assert res_admin1.status_code == 200


def test_effective_category_role_capping():
    # E-Cell club account requests a guest lecture
    login_res = client.post("/api/auth/login", json={
        "identifier": "club_ecell@cit.edu",
        "password": "Club@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/bookings", json={
        "title": "Startup Founders Speaker Session",
        "attendance": 80,
        "duration_periods": 2,
        "requested_category": "guest_lecture",
        "windows": [{"day": "WED", "from_period": 7, "to_period": 8}],
        "room_types": ["seminar_hall"]
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["effective_category"] == "club_event"
    assert "exceeded role ceiling" in data["rule_trace"].lower()


def test_reset_demo_idempotency():
    login_res = client.post("/api/auth/login", json={
        "identifier": "admin@cit.edu",
        "password": "Admin@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res1 = client.post("/api/admin/reset-demo", headers=headers)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["demo_accounts_count"] == 62

    # Second reset must be identical
    res2 = client.post("/api/admin/reset-demo", headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["demo_accounts_count"] == 62
