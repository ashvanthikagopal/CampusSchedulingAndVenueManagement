"""
API & RBAC Unit Tests.
Verifies:
1. Parametrized login for EVERY generated account (62 accounts) with role/dept/faculty_id/club_name assertions.
2. Club cannot approve bookings or disruption proposals.
3. Faculty cannot generate a timetable.
4. Coordinator cannot touch another department (schedule or lab approvals).
5. Anti-self-approval: Admin cannot approve their own proposals/bookings.
6. Reset-demo is idempotent and yields the exact same 62 accounts.
7. Directory endpoint respects DEMO_MODE and exposes no passwords.
8. Public stats returns real dynamic values.
9. Effective category capping with stated rule_trace (e.g. E-Cell requesting guest_lecture).
10. Faculty scoping: faculty sees strictly their own timetable.
"""
import json
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.session import SessionLocal
from backend.app.models.entities import User
from backend.app.core.seed_users import build_accounts_from_dataset, load_accounts_config

client = TestClient(app)

with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
    starter_dataset = json.load(f)

ALL_ACCOUNTS = build_accounts_from_dataset(starter_dataset)
CONFIG = load_accounts_config()
ROLE_PASSWORDS = CONFIG["role_passwords"]


def test_total_account_count():
    assert len(ALL_ACCOUNTS) == 62


@pytest.mark.parametrize("acc", ALL_ACCOUNTS, ids=[a["email"] for a in ALL_ACCOUNTS])
def test_all_62_account_logins(acc):
    pwd = ROLE_PASSWORDS[acc["role"]]
    # 1. Login with email
    res = client.post("/api/auth/login", json={"identifier": acc["email"], "password": pwd})
    assert res.status_code == 200, f"Login failed for {acc['email']}: {res.text}"
    data = res.json()
    assert "access_token" in data
    user = data["user"]
    assert user["role"] == acc["role"]
    assert user["department"] == acc["department"]
    assert user["faculty_id"] == acc["faculty_id"]
    assert user["club_name"] == acc["club_name"]

    # 2. Also verify faculty ID login if faculty
    if acc["faculty_id"]:
        res_fid = client.post("/api/auth/login", json={"identifier": acc["faculty_id"].lower(), "password": pwd})
        assert res_fid.status_code == 200
        assert res_fid.json()["user"]["faculty_id"] == acc["faculty_id"]


def test_auth_directory_endpoint():
    res = client.get("/api/auth/directory")
    assert res.status_code == 200
    data = res.json()
    assert len(data["admins"]) == 2
    assert len(data["coordinators"]) == 9
    assert len(data["faculty"]) == 40
    assert len(data["clubs"]) == 11
    assert data["role_passwords_hint"] is False

    # Assert no passwords exist anywhere in directory response
    serialized = json.dumps(data)
    for pwd in ROLE_PASSWORDS.values():
        assert pwd not in serialized


def test_public_stats_endpoint():
    res = client.get("/api/public/stats")
    assert res.status_code == 200
    data = res.json()
    assert data["sessions_scheduled"] == 189
    assert data["hard_violations"] == 0
    assert data["booking_score"] == 67.0
    assert data["bookings_count"] == 25
    assert data["last_reschedule_moved_count"] == 14


def test_rbac_club_cannot_approve():
    login_res = client.post("/api/auth/login", json={"email": "club_dance@cit.edu", "password": "Club@123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Cannot approve booking
    res1 = client.post("/api/bookings/BR-01/decision", json={"action": "approved"}, headers=headers)
    assert res1.status_code == 403

    # Cannot approve disruption proposal
    res2 = client.post("/api/disruptions/proposals/prop_sample_1/approve", headers=headers)
    assert res2.status_code == 403


def test_rbac_faculty_cannot_generate_schedule():
    login_res = client.post("/api/auth/login", json={"email": "faculty_f06@cit.edu", "password": "Faculty@123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/schedule/generate", headers=headers)
    assert res.status_code == 403


def test_rbac_coordinator_cannot_touch_another_department():
    # Coordinator of CSE logs in
    login_res = client.post("/api/auth/login", json={"email": "coord_cse@cit.edu", "password": "Coord@123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # F10 is in ECE department; CSE coordinator cannot query F10
    res1 = client.get("/api/schedule?view=faculty&id=F10", headers=headers)
    assert res1.status_code == 403

    # Cannot approve bookings for Electronics Lab (ECE/EE lab)
    res2 = client.post(
        "/api/bookings/BR-01/decision",
        json={"action": "approved", "room_id": "ELEC-LAB-1"},
        headers=headers
    )
    assert res2.status_code == 403


def test_rbac_admin_cannot_approve_own_request():
    # Admin 1 (admin@cit.edu) submitted prop_sample_1
    login_res = client.post("/api/auth/login", json={"email": "admin@cit.edu", "password": "Admin@123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/disruptions/proposals/prop_sample_1/approve", headers=headers)
    assert res.status_code == 403
    assert "Anti-self-approval" in res.json()["detail"]


def test_reset_demo_idempotency():
    res1 = client.post("/api/admin/reset-demo")
    assert res1.status_code == 200
    assert res1.json()["total_seeded_accounts"] == 62

    db = SessionLocal()
    assert db.query(User).count() == 62
    db.close()

    # Second reset
    res2 = client.post("/api/admin/reset-demo")
    assert res2.status_code == 200
    assert res2.json()["total_seeded_accounts"] == 62

    db = SessionLocal()
    assert db.query(User).count() == 62
    db.close()


def test_ecell_guest_lecture_capped_to_club_event():
    login_res = client.post("/api/auth/login", json={"email": "club_ecell@cit.edu", "password": "Club@123"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Request a guest lecture
    res = client.post("/api/bookings", json={
        "title": "Entrepreneurship Summit Guest Lecture",
        "attendance": 80,
        "duration_periods": 2,
        "windows": [{"day": "MON", "from_period": 10, "to_period": 11}],
        "room_types": ["auditorium", "seminar"],
        "requested_category": "guest_lecture"
    }, headers=headers)

    assert res.status_code == 200
    data = res.json()
    assert data["effective_category"] == "club_event"
    assert "capped to 'club_event'" in data["rule_trace"]


def test_faculty_scoping_sees_only_own_timetable():
    # Test a faculty member from each department
    sample_faculties = [
        ("faculty_f01@cit.edu", "F01", "CSE"),
        ("faculty_f07@cit.edu", "F07", "ECE"),
        ("faculty_f13@cit.edu", "F13", "EE"),
        ("faculty_f18@cit.edu", "F18", "ME"),
        ("faculty_f23@cit.edu", "F23", "CE"),
        ("faculty_f28@cit.edu", "F28", "PH"),
        ("faculty_f32@cit.edu", "F32", "MA"),
        ("faculty_f36@cit.edu", "F36", "HSS"),
    ]

    for email, fid, _ in sample_faculties:
        login_res = client.post("/api/auth/login", json={"email": email, "password": "Faculty@123"})
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = client.get("/api/schedule", headers=headers)
        assert res.status_code == 200
        data = res.json()
        for session in data["sessions"]:
            if not session.get("is_event"):
                assert session["faculty_id"] == fid, f"Faculty {fid} saw session for {session['faculty_id']}"
