"""
Domain models for the Zero Hour rules engine and solver.
Pure Python dataclasses with zero FastAPI or database dependencies.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional, Tuple, Any

CAT_WEIGHT = {
    "institute_event": 5,
    "guest_lecture": 4,
    "department_event": 3,
    "club_event": 2,
}
MAX_PERIOD = 13
LAST_TEACHING = 9


@dataclass
class Room:
    id: str
    name: str
    building: str
    type: str
    capacity: int
    features: List[str]
    accessible: bool
    allowed_uses: List[str]


@dataclass
class FacultyPreference:
    type: str
    days: List[str]
    periods: List[int]
    note: Optional[str] = None


@dataclass
class Faculty:
    id: str
    name: str
    department: str
    max_hours_per_day: int
    needs_accessible: bool
    unavailable: List[Dict[str, Any]] = field(default_factory=list)
    preferences: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class StudentGroup:
    id: str
    name: str
    year: int
    department: str
    size: int
    needs_accessible: bool


@dataclass
class Course:
    id: str
    name: str
    lecture_hours: int
    tutorial_hours: int
    lab_blocks: int


@dataclass
class Session:
    id: str
    course_id: str
    kind: str  # lecture | tutorial | lab
    groups: List[str]
    faculty_id: str
    size: int
    duration: int
    room_types: List[str]
    needs_accessible: bool
    basket_slot: Optional[str] = None
    fixed_slot: Optional[Dict[str, Any]] = None


@dataclass
class BookingRequest:
    id: str
    submitted_at: str
    requester: str
    role: str
    requested_category: str
    title: str
    attendance: int
    duration_periods: int
    windows: List[Dict[str, Any]]
    room_types: List[str]
    needs: List[str]
    requested_room: Optional[str] = None
    mandatory_for_groups: List[str] = field(default_factory=list)
    series_id: Optional[str] = None
    raw_text: Optional[str] = None


@dataclass
class Exam:
    id: str
    course_ids: List[str]
    groups: List[str]
    size: int
    duration_hours: int


@dataclass
class DatasetContext:
    dataset_id: str
    calendar: Dict[str, Any]
    priority_order: List[str]
    role_category_cap: Dict[str, str]
    rooms: Dict[str, Room]
    faculty: Dict[str, Faculty]
    student_groups: Dict[str, StudentGroup]
    courses: Dict[str, Course]
    sessions: Dict[str, Session]
    booking_requests: Dict[str, BookingRequest]
    cancellations: Set[str]
    room_unavailability: Dict[str, Set[Tuple[str, int]]]  # room_id -> set of (day, period)
    faculty_unavailability: Dict[str, Set[Tuple[str, int]]]  # faculty_id -> set of (day, period)
    raw_data: Dict[str, Any]

    @property
    def days(self) -> List[str]:
        return self.calendar.get("days", ["MON", "TUE", "WED", "THU", "FRI"])

    @property
    def lab_starts(self) -> Set[int]:
        return set(self.calendar.get("lab_start_periods", [2, 6]))

    @property
    def lunch_after(self) -> int:
        return self.calendar.get("lunch", {}).get("after_period", 5)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DatasetContext":
        rooms = {
            r["id"]: Room(
                id=r["id"],
                name=r["name"],
                building=r.get("building", ""),
                type=r["type"],
                capacity=r["capacity"],
                features=r.get("features", []),
                accessible=r.get("accessible", False),
                allowed_uses=r.get("allowed_uses", []),
            )
            for r in data.get("rooms", [])
        }

        faculty = {
            f["id"]: Faculty(
                id=f["id"],
                name=f["name"],
                department=f.get("department", ""),
                max_hours_per_day=f.get("max_hours_per_day", 4),
                needs_accessible=f.get("needs_accessible", False),
                unavailable=f.get("unavailable", []),
                preferences=f.get("preferences", []),
            )
            for f in data.get("faculty", [])
        }

        groups = {
            g["id"]: StudentGroup(
                id=g["id"],
                name=g["name"],
                year=g.get("year", 1),
                department=g.get("department", ""),
                size=g.get("size", 0),
                needs_accessible=g.get("needs_accessible", False),
            )
            for g in data.get("student_groups", [])
        }

        courses = {
            c["id"]: Course(
                id=c["id"],
                name=c.get("name", ""),
                lecture_hours=c.get("lecture_hours", 0),
                tutorial_hours=c.get("tutorial_hours", 0),
                lab_blocks=c.get("lab_blocks", 0),
            )
            for c in data.get("courses", [])
        }

        sessions = {
            s["id"]: Session(
                id=s["id"],
                course_id=s["course_id"],
                kind=s["kind"],
                groups=s.get("groups", []),
                faculty_id=s["faculty_id"],
                size=s["size"],
                duration=s["duration"],
                room_types=s["room_types"],
                needs_accessible=s.get("needs_accessible", False),
                basket_slot=s.get("basket_slot"),
                fixed_slot=s.get("fixed_slot"),
            )
            for s in data.get("sessions", [])
        }

        requests = {
            b["id"]: BookingRequest(
                id=b["id"],
                submitted_at=b["submitted_at"],
                requester=b.get("requester", ""),
                role=b.get("role", "club"),
                requested_category=b.get("requested_category", "club_event"),
                title=b.get("title", ""),
                attendance=b.get("attendance", 0),
                duration_periods=b.get("duration_periods", 1),
                windows=b.get("windows", []),
                room_types=b.get("room_types", []),
                needs=b.get("needs", []),
                requested_room=b.get("requested_room"),
                mandatory_for_groups=b.get("mandatory_for_groups", []),
                series_id=b.get("series_id"),
                raw_text=b.get("raw_text"),
            )
            for b in data.get("booking_requests", [])
        }

        cancellations = {c["request_id"] for c in data.get("cancellations", [])}

        fac_un = {}
        for f in data.get("faculty", []):
            un_set = set()
            for u in f.get("unavailable", []):
                day = u["day"]
                for p in u.get("periods", []):
                    un_set.add((day, p))
            fac_un[f["id"]] = un_set

        room_un = {}
        for u in data.get("room_unavailability", []):
            rid = u["room_id"]
            if rid not in room_un:
                room_un[rid] = set()
            day = u["day"]
            for p in u.get("periods", []):
                room_un[rid].add((day, p))

        return cls(
            dataset_id=data.get("dataset_id", "cit-public-v1"),
            calendar=data.get("calendar", {}),
            priority_order=data.get("priority_order", [
                "exam", "regular_session", "institute_event",
                "guest_lecture", "department_event", "club_event"
            ]),
            role_category_cap=data.get("role_category_cap", {
                "admin": "institute_event",
                "faculty": "guest_lecture",
                "department_coordinator": "department_event",
                "club": "club_event"
            }),
            rooms=rooms,
            faculty=faculty,
            student_groups=groups,
            courses=courses,
            sessions=sessions,
            booking_requests=requests,
            cancellations=cancellations,
            room_unavailability=room_un,
            faculty_unavailability=fac_un,
            raw_data=data,
        )


def effective_category(ctx: DatasetContext, req: BookingRequest) -> str:
    order = ctx.priority_order
    cap = ctx.role_category_cap.get(req.role, "club_event")
    a = order.index(req.requested_category) if req.requested_category in order else len(order) - 1
    return order[max(a, order.index(cap))]


def outranks(ctx: DatasetContext, r1: BookingRequest, r2: BookingRequest) -> bool:
    order = ctx.priority_order
    c1 = order.index(effective_category(ctx, r1))
    c2 = order.index(effective_category(ctx, r2))
    if c1 != c2:
        return c1 < c2
    return r1.submitted_at < r2.submitted_at

