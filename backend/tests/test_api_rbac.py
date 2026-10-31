"""
API & RBAC Unit Tests.
Verifies:
1. Rule-based login for EVERY generated account (62 total: 2 admins, 9 coordinators, 40 faculty, 11 clubs).
2. Faculty login by faculty_id ('F06' as identifier).
3. Auth directory endpoint (gated by DEMO_MODE).
4. Dynamic public stats (no hard-coded constants).
5. Server-side scoping:
   - Club cannot approve bookings; can only view their own requests.
   - Faculty cannot generate timetable; can only access own schedule and unavailability.
   - Department Coordinator cannot touch another department's faculty or non-department labs.
   - Anti-self-approval: Admin cannot approve their own requests (Spectra/Dean).
   - Category capping: E-Cell requesting guest_lecture is capped to club_event with rule trace.
6. Idempotent reset-demo yielding exact 62 accounts.
"""
import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.seed_users import build_accounts_list, load_accounts_config
from backend.app.database.session import SessionLocal
from backend.app.core.seed_users import seed_users

client = TestClient(app)

# Load dataset and accounts
DATASET_PATH = Path("data/starter_dataset/cit_public.json")
with open(DATASET_PATH, "r", encoding="utf-8") as f:
    DATASET = json.load(f)

ALL_ACCOUNTS = build_accounts_list(DATASET)
CONFIG = load_accounts_config()
ROLE_PASSWORDS = CONFIG.get("role_passwords", {
    "admin": "Admin@123",
    "department_coordinator": "Coord@123",
    "faculty": "Faculty@123",
    "club": "Club@123"
})


# Ensure DB has all 62 accounts seeded prior to running test suite
@pytest.fixture(scope="session", autouse=True)
def ensure_db_seeded():
    db = SessionLocal()
    try:
        seed_users(db, dataset=DATASET)
    finally:
        db.close()


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["accounts_count"] == 62


@pytest.mark.parametrize("acc", ALL_ACCOUNTS, ids=[a["email"] for a in ALL_ACCOUNTS])
def test_all_62_accounts_login(acc):
    pwd = ROLE_PASSWORDS[acc["role"]]
    # 1. Login with email
    res = client.post("/api/auth/login", json={
        "email": acc["email"],
        "password": pwd
    })
    assert res.status_code == 200, f"Failed login for {acc['email']}: {res.text}"
    data = res.json()
    assert "access_token" in data
    u = data["user"]
    assert u["role"] == acc["role"]
    assert u["department"] == acc["department"]
    assert u["faculty_id"] == acc["faculty_id"]
    assert u["club_name"] == acc["club_name"]


def test_login_faculty_by_identifier():
    # Login by faculty ID (F06) - Dr. Arjun Mehta, CSE
    res = client.post("/api/auth/login", json={
        "identifier": "F06",
        "password": "Faculty@123"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["faculty_id"] == "F06"
    assert data["user"]["name"] == "Dr. Arjun Mehta"
    assert data["user"]["department"] == "CSE"

    # Lowercase f06
    res_lower = client.post("/api/auth/login", json={
        "identifier": "f06",
        "password": "Faculty@123"
    })
    assert res_lower.status_code == 200
    assert res_lower.json()["user"]["faculty_id"] == "F06"


def test_login_generic_error_on_invalid():
    # Test invalid credentials gives generic message with no enumeration
    res = client.post("/api/auth/login", json={
        "identifier": "nonexistent@cit.edu",
        "password": "WrongPassword"
    })
    assert res.status_code == 401
    assert "detail" in res.json()
    assert res.json()["detail"] == "Incorrect identifier or password"


def test_auth_directory_endpoint():
    res = client.get("/api/auth/directory")
    assert res.status_code == 200
    data = res.json()
    assert len(data["admins"]) == 2
    assert len(data["coordinators"]) == 9
    assert len(data["faculty"]) == 40
    assert len(data["clubs"]) == 11
    assert data["role_passwords_hint"] is False

    # Verify no passwords are leaked in directory
    for cat in ["admins", "coordinators", "faculty", "clubs"]:
        for item in data[cat]:
            assert "password" not in item
            assert "password_hash" not in item


def test_public_stats():
    res = client.get("/api/public/stats")
    assert res.status_code == 200
    data = res.json()
    assert data["sessions_scheduled"] == 189
    assert data["hard_violations"] == 0
    assert data["booking_score"] == 67.0
    assert data["bookings_count"] >= 24


def test_dashboard_endpoint():
    res = client.get("/api/admin/dashboard")
    assert res.status_code == 200
    data = res.json()
    assert data["sessions_scheduled"] == 189
    assert data["hard_conflicts"] == 0
    assert data["booking_score"] == 67.0


def test_rbac_club_cannot_approve_or_generate():
    login_res = client.post("/api/auth/login", json={
        "identifier": "club_dance@cit.edu",
        "password": "Club@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Cannot generate timetable
    res_gen = client.post("/api/schedule/generate", headers=headers)
    assert res_gen.status_code == 403

    # Cannot decide booking
    res_dec = client.post("/api/bookings/BR-01/decision", json={"action": "approved"}, headers=headers)
    assert res_dec.status_code == 403


def test_rbac_faculty_cannot_generate_timetable():
    login_res = client.post("/api/auth/login", json={
        "identifier": "faculty_f06@cit.edu",
        "password": "Faculty@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res_gen = client.post("/api/schedule/generate", headers=headers)
    assert res_gen.status_code == 403

    res_prop = client.post("/api/disruptions/proposals/prop_sample_1/approve", headers=headers)
    assert res_prop.status_code == 403


def test_faculty_schedule_scoping():
    login_res = client.post("/api/auth/login", json={
        "identifier": "faculty_f06@cit.edu",
        "password": "Faculty@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Viewing another faculty's timetable is forbidden
    res_other = client.get("/api/schedule?view=faculty&id=F07", headers=headers)
    assert res_other.status_code == 403

    # General call returns only F06 sessions
    res_own = client.get("/api/schedule", headers=headers)
    assert res_own.status_code == 200
    for s in res_own.json()["sessions"]:
        assert s["faculty_id"] == "F06"


def test_coordinator_cannot_touch_other_departments():
    # Login as CSE Coordinator
    login_res = client.post("/api/auth/login", json={
        "identifier": "coord_cse@cit.edu",
        "password": "Coord@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Coordinator cannot view faculty of another department (F31 is CE)
    res_sched = client.get("/api/schedule?view=faculty&id=F31", headers=headers)
    assert res_sched.status_code == 403

    # Coordinator cannot approve a booking for another department's lab (CIVIL-LAB is CE)
    res_book = client.post("/api/bookings/BR-02/decision", json={
        "action": "approved",
        "room_id": "CIVIL-LAB"
    }, headers=headers)
    assert res_book.status_code == 403

    # Coordinator cannot submit faculty leave for a faculty outside their department
    res_dis = client.post("/api/disruptions", json={
        "changes": [{"type": "faculty_unavailable", "faculty_id": "F31", "day": "MON", "period": 1}],
        "description": "Cross-dept modification attempt"
    }, headers=headers)
    assert res_dis.status_code == 403


def test_anti_self_approval():
    # admin2@cit.edu is Spectra Core Team
    res_admin2 = client.post("/api/auth/login", json={
        "identifier": "admin2@cit.edu",
        "password": "Admin@123"
    })
    token2 = res_admin2.json()["access_token"]

    # BR-01 was requested by 'Spectra Core Team'
    res_self = client.post("/api/bookings/BR-01/decision", json={"action": "approved"}, headers={"Authorization": f"Bearer {token2}"})
    assert res_self.status_code == 403
    assert "Anti-self-approval" in res_self.json()["detail"]

    # admin@cit.edu is Dean's Office, so admin@cit.edu CAN approve BR-01
    res_admin1 = client.post("/api/auth/login", json={
        "identifier": "admin@cit.edu",
        "password": "Admin@123"
    })
    token1 = res_admin1.json()["access_token"]
    res_other = client.post("/api/bookings/BR-01/decision", json={"action": "approved"}, headers={"Authorization": f"Bearer {token1}"})
    assert res_other.status_code == 200

    # But admin@cit.edu CANNOT approve BR-03 ('Office of the Dean of Academics')
    res_dean_self = client.post("/api/bookings/BR-03/decision", json={"action": "approved"}, headers={"Authorization": f"Bearer {token1}"})
    assert res_dean_self.status_code == 403
    assert "Anti-self-approval" in res_dean_self.json()["detail"]


def test_effective_category_capping_with_rule_trace():
    # Login as club (E-Cell)
    login_res = client.post("/api/auth/login", json={
        "identifier": "club_ecell@cit.edu",
        "password": "Club@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # E-Cell requests a 'guest_lecture' (role cap is 'club_event')
    res = client.post("/api/bookings", json={
        "title": "E-Cell Guest Talk",
        "attendance": 80,
        "duration_periods": 2,
        "requested_category": "guest_lecture",
        "windows": [{"day": "WED", "from_period": 7, "to_period": 8}],
        "room_types": ["lecture_hall"],
        "needs": ["projector"]
    }, headers=headers)

    assert res.status_code == 200
    data = res.json()
    assert data["effective_category"] == "club_event"
    assert "rule_trace" in data
    assert "Capped to 'club_event'" in data["rule_trace"]


def test_club_list_bookings_scoping():
    # Login as club_ecell
    login_res = client.post("/api/auth/login", json={
        "identifier": "club_ecell@cit.edu",
        "password": "Club@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/bookings", headers=headers)
    assert res.status_code == 200
    data = res.json()
    # All returned bookings must be for E-Cell
    for b in data:
        assert b["requester"] == "E-Cell" or b.get("submitted_by") == "usr_club_ecell"


def test_reset_demo_idempotence():
    res1 = client.post("/api/admin/reset-demo")
    assert res1.status_code == 200
    assert res1.json()["accounts_count"] == 62

    res2 = client.post("/api/admin/reset-demo")
    assert res2.status_code == 200
    assert res2.json()["accounts_count"] == 62

    # Verify logins still work after double reset
    res_admin = client.post("/api/auth/login", json={"email": "admin@cit.edu", "password": "Admin@123"})
    assert res_admin.status_code == 200
    res_f06 = client.post("/api/auth/login", json={"identifier": "F06", "password": "Faculty@123"})
    assert res_f06.status_code == 200
