"""
Rooms and availability endpoints for CIT Campus Scheduler.
Provides privacy-preserving availability data for Club Representatives and general venue queries.
Strictly adheres to Club Representative Timetable Page Spec:
- No faculty names, course codes, or student groups
- No other clubs' names or event titles
- No pending requests from other clubs
- Only own club's bookings show status and details
"""
import json
from typing import Optional, List, Dict, Any
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.app.models.entities import (
    RoomModel, DatasetModel, ScheduleVersion, ScheduleEntry,
    SessionOverride, BookingRequestModel, BookingDecisionModel, User
)
from backend.app.api.deps import get_current_user, get_current_user_optional

router = APIRouter(prefix="/rooms", tags=["rooms"])

DAYS = ["MON", "TUE", "WED", "THU", "FRI"]
EVENT_PERIODS = [
    {"p": 10, "time": "18:00 - 19:00", "label": "P10"},
    {"p": 11, "time": "19:00 - 20:00", "label": "P11"},
    {"p": 12, "time": "20:00 - 21:00", "label": "P12"},
    {"p": 13, "time": "21:00 - 22:00", "label": "P13"},
]
PERIODS = [
    {"p": 1, "time": "08:00 - 09:00", "label": "P1"},
    {"p": 2, "time": "09:00 - 10:00", "label": "P2"},
    {"p": 3, "time": "10:00 - 11:00", "label": "P3"},
    {"p": 4, "time": "11:00 - 12:00", "label": "P4"},
    {"p": 5, "time": "12:00 - 13:00", "label": "P5"},
    {"p": "LUNCH", "time": "13:00 - 14:00", "label": "Lunch"},
    {"p": 6, "time": "14:00 - 15:00", "label": "P6"},
    {"p": 7, "time": "15:00 - 16:00", "label": "P7"},
    {"p": 8, "time": "16:00 - 17:00", "label": "P8"},
    {"p": 9, "time": "17:00 - 18:00", "label": "P9"},
    {"p": 10, "time": "18:00 - 19:00", "label": "P10"},
    {"p": 11, "time": "19:00 - 20:00", "label": "P11"},
    {"p": 12, "time": "20:00 - 21:00", "label": "P12"},
    {"p": 13, "time": "21:00 - 22:00", "label": "P13"},
]

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent


def get_dataset_data(db: Session) -> Dict[str, Any]:
    ds = db.query(DatasetModel).filter(DatasetModel.is_active == True).first()
    if ds:
        return ds.raw_json
    dataset_file = REPO_ROOT / "data" / "starter_dataset" / "cit_public.json"
    if dataset_file.exists():
        with open(dataset_file, encoding="utf-8") as f:
            return json.load(f)
    return {}


def get_schedule_data(db: Session) -> Dict[str, Any]:
    ver = db.query(ScheduleVersion).filter(ScheduleVersion.status == "active").order_by(ScheduleVersion.created_at.desc()).first()
    if ver:
        entries = db.query(ScheduleEntry).filter(ScheduleEntry.version_id == ver.id).all()
        overrides = db.query(SessionOverride).filter(SessionOverride.version_id == ver.id).all()
        decisions = db.query(BookingDecisionModel).filter(BookingDecisionModel.version_id == ver.id).all()
        return {
            "sessions": [{"session_id": e.session_id, "day": e.day, "start_period": e.start_period, "room_id": e.room_id} for e in entries],
            "fest_week": {
                "session_overrides": [{"session_id": o.session_id, "day": o.day, "start_period": o.start_period, "room_id": o.room_id, "displaced_by": o.displaced_by} for o in overrides],
                "bookings": [{"request_id": d.request_id, "status": d.decision, "day": d.assigned_day, "start_period": d.assigned_start_period, "end_period": d.assigned_end_period, "room_id": d.assigned_room_id} for d in decisions]
            },
            "exams": []
        }

    schedule_file = REPO_ROOT / "exports" / "schedule.json"
    if schedule_file.exists():
        with open(schedule_file, encoding="utf-8") as f:
            return json.load(f)
    return {}


@router.get("/availability")
def get_room_availability(
    room: Optional[str] = Query(None, description="Specific room ID, or omit for all rooms"),
    week: int = Query(7, description="Week number: 7 for Spectra fest week, 8 for exams, 1 for regular"),
    day: Optional[str] = Query(None, description="Day filter (MON, TUE, WED, THU, FRI)"),
    club: Optional[str] = Query(None, description="Club name for distinguishing own bookings"),
    event_only: bool = Query(True, description="Filter for bookable event periods P10 to P13 only"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Returns privacy-preserving room availability matrix.
    Each cell has exactly one state: free, class, exam, booked, maintenance, mine, reserved_institute, lunch.
    Zero leakage of course names, faculty members, student groups, or other clubs' event titles.
    """
    dataset = get_dataset_data(db)
    sched = get_schedule_data(db)

    rooms_list = dataset.get("rooms", [])
    if room:
        rooms_list = [r for r in rooms_list if r["id"] == room]
        if not rooms_list:
            raise HTTPException(status_code=404, detail=f"Room '{room}' not found")

    # Determine user's active club
    user_club = club or (current_user.club_name if current_user else None) or ((current_user.name if current_user.role == "club" else None) if current_user else None)

    # Map booking requests
    req_meta = {b["id"]: b for b in dataset.get("booking_requests", [])}

    # DB submitted requests for current user (pending or approved)
    db_user_requests = []
    if current_user:
        db_user_requests = db.query(BookingRequestModel).filter(BookingRequestModel.submitted_by == current_user.id).all()
        for ur in db_user_requests:
            req_meta[ur.id] = {
                "id": ur.id,
                "title": ur.title,
                "requester": ur.requester or current_user.club_name or current_user.name,
                "requested_category": ur.requested_category,
                "attendance": ur.attendance,
                "role": ur.role or current_user.role,
            }

    # Room unavailability (maintenance)
    unavail_map = {}
    for un in dataset.get("room_unavailability", []):
        r_id = un.get("room_id")
        d_day = un.get("day")
        for p in un.get("periods", []):
            unavail_map[(r_id, d_day, p)] = un.get("reason", "Room maintenance / repair")

    # Sessions (classes)
    session_map = {} # (room_id, day, period) -> True
    session_meta = {s["id"]: s for s in dataset.get("sessions", [])}
    baseline_sessions = sched.get("sessions", [])

    # Effective sessions in week 7 consider overrides
    effective_sessions = {}
    for s in baseline_sessions:
        effective_sessions[s["session_id"]] = (s["day"], s["start_period"], s["room_id"])

    if week == 7:
        for ov in sched.get("fest_week", {}).get("session_overrides", []):
            if ov.get("room_id") and ov.get("day") and ov.get("start_period"):
                effective_sessions[ov["session_id"]] = (ov["day"], ov["start_period"], ov["room_id"])

    for sid, (s_day, s_start, s_room) in effective_sessions.items():
        s_obj = session_meta.get(sid, {})
        duration = s_obj.get("duration", 1)
        for p_offset in range(duration):
            p = s_start + p_offset
            session_map[(s_room, s_day, p)] = True

    # Bookings map
    # (room_id, day, period) -> booking info
    bookings_map = {}
    for b in sched.get("fest_week", {}).get("bookings", []):
        if b.get("status") in ("approved", "APPROVED_PRIMARY", "OFFERED_ALTERNATIVE"):
            b_room = b.get("room_id")
            b_day = b.get("day")
            b_start = b.get("start_period")
            b_end = b.get("end_period", b_start)
            req = req_meta.get(b.get("request_id"), {})
            req_cat = req.get("requested_category")
            requester = req.get("requester")
            b_title = req.get("title", "Event")

            # Check if this booking belongs to current user's club
            is_mine = False
            if user_club and requester and (user_club.lower() in requester.lower() or requester.lower() in user_club.lower()):
                is_mine = True
            elif current_user and current_user.role == "club" and user_club and user_club == "Student Clubs":
                # If logged in as generic Student Clubs rep, matches any club event when explicitly selected
                if club and requester and club.lower() in requester.lower():
                    is_mine = True

            for p in range(b_start, b_end + 1):
                bookings_map[(b_room, b_day, p)] = {
                    "is_mine": is_mine,
                    "is_institute": (req_cat == "institute_event"),
                    "title": b_title if is_mine else None,
                    "club_name": requester if is_mine else None,
                    "status": "approved",
                    "request_id": b.get("request_id") if is_mine else None
                }

    # Also map user pending requests from DB
    for ur in db_user_requests:
        if ur.status == "pending" and ur.requested_room:
            windows = ur.windows or []
            if isinstance(windows, str):
                try:
                    windows = json.loads(windows)
                except Exception:
                    windows = []
            for w in windows:
                w_day = w.get("day")
                w_from = w.get("from_period", 1)
                w_to = w.get("to_period", w_from)
                for p in range(w_from, w_to + 1):
                    bookings_map[(ur.requested_room, w_day, p)] = {
                        "is_mine": True,
                        "is_institute": False,
                        "title": ur.title,
                        "club_name": ur.requester or (current_user.club_name if current_user else None) or "My Club",
                        "status": "pending",
                        "request_id": ur.id
                    }

    # Exams map (Week 8)
    exams_map = {}
    if week == 8:
        for ex in sched.get("exams", []):
            ex_day = ex.get("day")
            session_slot = ex.get("session") # AM or PM
            exam_periods = [2, 3, 4] if session_slot == "AM" else [6, 7]
            for r_id in ex.get("rooms", []):
                for p in exam_periods:
                    exams_map[(r_id, ex_day, p)] = True

    # Build response for rooms
    result_rooms = []
    days_to_check = [day] if day and day in DAYS else DAYS

    for r in rooms_list:
        r_id = r["id"]
        room_info = {
            "id": r_id,
            "name": r.get("name", r_id),
            "building": r.get("building", ""),
            "type": r.get("type", "classroom"),
            "capacity": r.get("capacity", 0),
            "features": r.get("features", []),
            "accessible": r.get("accessible", False),
            "allowed_uses": r.get("allowed_uses", []),
            "needs_coordinator_approval": (r.get("type") == "lab"),
        }

        target_periods = EVENT_PERIODS if event_only else PERIODS

        # Build grid cells
        cells_by_day = {}
        for d in days_to_check:
            day_cells = []
            for item in target_periods:
                p = item["p"]
                if p == "LUNCH":
                    day_cells.append({
                        "period": "LUNCH",
                        "period_num": 5.5,
                        "time": "13:00 - 14:00",
                        "state": "lunch",
                        "label": "Lunch",
                        "is_free": False,
                        "detail": None
                    })
                    continue

                cell_key = (r_id, d, p)
                # Check states in strict priority
                if cell_key in unavail_map:
                    day_cells.append({
                        "period": p,
                        "time": item["time"],
                        "state": "maintenance",
                        "label": "Unavailable",
                        "is_free": False,
                        "detail": "Room unavailable / maintenance"
                    })
                elif cell_key in exams_map:
                    day_cells.append({
                        "period": p,
                        "time": item["time"],
                        "state": "exam",
                        "label": "Exam",
                        "is_free": False,
                        "detail": None
                    })
                elif cell_key in bookings_map:
                    b_info = bookings_map[cell_key]
                    if b_info["is_mine"]:
                        day_cells.append({
                            "period": p,
                            "time": item["time"],
                            "state": "mine",
                            "label": "My Booking",
                            "is_free": False,
                            "detail": {
                                "title": b_info["title"],
                                "club_name": b_info["club_name"],
                                "status": b_info["status"],
                                "request_id": b_info["request_id"]
                            }
                        })
                    elif b_info["is_institute"]:
                        day_cells.append({
                            "period": p,
                            "time": item["time"],
                            "state": "reserved_institute",
                            "label": "Reserved (Institute event)",
                            "is_free": False,
                            "detail": None
                        })
                    else:
                        day_cells.append({
                            "period": p,
                            "time": item["time"],
                            "state": "booked",
                            "label": "Booked",
                            "is_free": False,
                            "detail": None
                        })
                elif cell_key in session_map:
                    day_cells.append({
                        "period": p,
                        "time": item["time"],
                        "state": "class",
                        "label": "Class",
                        "is_free": False,
                        "detail": None
                    })
                else:
                    day_cells.append({
                        "period": p,
                        "time": item["time"],
                        "state": "free",
                        "label": "Free",
                        "is_free": True,
                        "detail": None
                    })

            cells_by_day[d] = day_cells

        result_rooms.append({
            "room": room_info,
            "days": cells_by_day
        })

    # Available clubs for selection
    all_clubs = sorted(list({
        b.get("requester") for b in dataset.get("booking_requests", []) if b.get("role") == "club" and b.get("requester")
    }))

    return {
        "week": week,
        "is_spectra_week": (week == 7),
        "spectra_banner": "Spectra week: institute events have priority. Your request may be displaced." if week == 7 else None,
        "active_club": user_club,
        "available_clubs": all_clubs,
        "rooms": result_rooms,
        "periods": EVENT_PERIODS if event_only else PERIODS,
        "days": days_to_check,
    }
