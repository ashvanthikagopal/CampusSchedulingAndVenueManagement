import urllib.request
import json

tests = [
    ("ADMIN", "admin@cit.edu", "Admin@123"),
    ("COORDINATOR", "coord_cse@cit.edu", "Coord@123"),
    ("FACULTY", "faculty_f06@cit.edu", "Faculty@123"),
    ("FACULTY_BY_ID", "F06", "Faculty@123"),
    ("CLUB", "club_dance@cit.edu", "Club@123"),
]

for label, ident, pwd in tests:
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/auth/login",
        data=json.dumps({"identifier": ident, "password": pwd}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        u = data["user"]
        print(f"SUCCESS {label}: Name='{u['name']}', Role='{u['role']}', Email='{u['email']}', Dept='{u.get('department')}', FacultyID='{u.get('faculty_id')}'")

