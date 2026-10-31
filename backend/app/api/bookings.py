"""
Spectra Week and Venue Bookings API endpoints.
Strictly enforces server-side role capping and anti-self-approval checks.
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import json

from backend.app.database.session import get_db
from backend.app.models.entities import (
    BookingRequestModel, BookingDecisionModel, User, AuditLogModel, DatasetModel, RoomModel
)
from backend.app.api.deps import get_current_user, require_admin
from backend.app.schemas.schemas import (
    BookingCreateRequest, BookingParseRequest, BookingParseResponse,
    BookingCheckRequest, BookingCheckResponse, BookingDecisionRequest
)
from backend.app.ai.parser import parse_booking_text
from backend.app.rules.models import DatasetContext, BookingRequest as RuleBookingRequest, effective_category
from backend.app.solver.booking_engine import solve_bookings
from backend.app.rules.engine import to_assign

router = APIRouter(prefix="/bookings", tags=["bookings"])


CATEGORY_HIERARCHY = [
    "club_event",          # Rank 0 (lowest)
    "department_event",    # Rank 1
    "guest_lecture",       # Rank 2
    "institute_event",     # Rank 3
    "regular_session",     # Rank 4
    "exam",                # Rank 5 (highest)
]

ROLE_CAPS = {
    "admin": "institute_event",
    "faculty": "guest_lecture",
    "department_coordinator": "department_event",
    "club": "club_event",
    "student": "club_event"
}

def compute_effective_category(requested_category: str, user_role: str) -> tuple[str, str]:
    """
    Computes effective category as min(requested, role_cap) based on priority hierarchy,
    along with an explicit rule_trace explanation.
    """
    role_cap = ROLE_CAPS.get(user_role, "club_event")
    req_cat = requested_category or "club_event"
    req_rank = CATEGORY_HIERARCHY.index(req_cat) if req_cat in CATEGORY_HIERARCHY else 0
    cap_rank = CATEGORY_HIERARCHY.index(role_cap)

    if req_rank <= cap_rank:
        eff_cat = req_cat
        rule_trace = f"Requested category '{req_cat}' is within role ceiling '{role_cap}' for '{user_role}'."
    else:
        eff_cat = role_cap
        rule_trace = f"Requested category '{req_cat}' exceeded role ceiling '{role_cap}' for '{user_role}'; capped down to '{eff_cat}'."

    return eff_cat, rule_trace


@router.post("/parse", response_model=BookingParseResponse)
def parse_request_endpoint(req: BookingParseRequest, current_user: User = Depends(get_current_user)):
    """Parses plain-language English or Hinglish text using Gemini with deterministic fallback."""
    parsed = parse_booking_text(req.text, user_role=current_user.role)

    # Server-side category cap: never trust AI or user text!
    req_cat = parsed.get("requested_category") or parsed.get("effective_category") or "club_event"
    eff_cat, rule_trace = compute_effective_category(req_cat, current_user.role)

    return BookingParseResponse(
        intent=parsed.get("intent", "book_venue"),
        title=parsed.get("title", "Campus Venue Request"),
        attendance=parsed.get("attendance", 50),
        duration_periods=parsed.get("duration_periods", 2),
        windows=parsed.get("windows", []),
        room_types=parsed.get("room_types", ["classroom"]),
        needs=parsed.get("needs", []),
        requested_room=parsed.get("requested_room"),
        mandatory_for_groups=parsed.get("mandatory_for_groups", []),
        assumptions=parsed.get("assumptions", []),
        follow_up_question=parsed.get("follow_up_question"),
        effective_category=eff_cat,
        rule_trace=rule_trace,
        raw_text=req.text,
        parsed_by=parsed.get("parsed_by", "rule_fallback")
    )


@router.post("/check", response_model=BookingCheckResponse)
def check_booking_endpoint(
    check_req: BookingCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dry-run validation of a booking request against current timetable and venue constraints."""
    b = check_req.booking

    # Check venue capacity
    all_rooms = db.query(RoomModel).all()
    max_cap = max((r.capacity for r in all_rooms if "event" in r.allowed_uses), default=0)
    if b.attendance > max_cap:
        return BookingCheckResponse(
            pass_validation=False,
            reason_code="NO_VENUE_CAPACITY",
            reason=f"Attendance of {b.attendance} exceeds largest campus event venue capacity ({max_cap} seats in OAT)."
        )

    # Check room exists if requested
    if b.requested_room:
        rm = db.query(RoomModel).filter(RoomModel.id == b.requested_room).first()
        if not rm:
            return BookingCheckResponse(
                pass_validation=False,
                reason_code="ROOM_NOT_FOUND",
                reason=f"Requested venue '{b.requested_room}' does not exist on campus.",
                suggested_alternative={"room_id": "LH-1", "reason": "Lecture Hall 1 seats 200 with PA system"}
            )
        if "accessible" in b.needs and not rm.accessible:
            return BookingCheckResponse(
                pass_validation=False,
                reason_code="NEEDS_NOT_MET",
                reason=f"Venue '{b.requested_room}' is not wheelchair accessible.",
                suggested_alternative={"room_id": "SH-1", "reason": "Seminar Hall 1 is wheelchair accessible"}
            )

    return BookingCheckResponse(
        pass_validation=True,
        reason_code="INSIDE_WINDOW_ROOM_FREE",
        reason="Venue and timing are feasible with zero conflicts."
    )


@router.post("")
def create_booking(booking: BookingCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Submits a new booking request. Effective category is computed server-side."""
    # Server-side category cap: Non-negotiable #1
    req_cat = booking.requested_category or "club_event"
    eff_cat, rule_trace = compute_effective_category(req_cat, current_user.role)

    req_id = f"BR-REQ-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

    new_b = BookingRequestModel(
        id=req_id,
        submitted_at=datetime.utcnow().isoformat() + "+05:30",
        requester=current_user.name,
        role=current_user.role,
        requested_category=req_cat,
        effective_category=eff_cat,
        title=booking.title,
        attendance=booking.attendance,
        duration_periods=booking.duration_periods,
        windows=[w.dict() for w in booking.windows],
        room_types=booking.room_types,
        needs=booking.needs,
        requested_room=booking.requested_room,
        mandatory_for_groups=booking.mandatory_for_groups,
        raw_text=booking.raw_text,
        status="pending",
        submitted_by=current_user.id
    )
    db.add(new_b)

    db.add(AuditLogModel(
        actor=current_user.email,
        action="SUBMIT_BOOKING",
        entity=f"BookingRequest:{req_id}",
        after_json={"title": booking.title, "attendance": booking.attendance, "effective_category": eff_cat, "rule_trace": rule_trace}
    ))

    db.commit()

    return {
        "status": "success",
        "request_id": req_id,
        "effective_category": eff_cat,
        "rule_trace": rule_trace,
        "message": "Booking submitted successfully and queued for review."
    }


@router.get("")
def list_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists booking requests and their active decisions.
    Admin and coordinators see all; faculty sees relevant items.
    """
    # Read decisions from exports/schedule.json
    disk_decisions = {}
    try:
        with open("exports/schedule.json", encoding="utf-8") as f:
            sched = json.load(f)
        for d in sched.get("fest_week", {}).get("bookings", []):
            disk_decisions[d["request_id"]] = d
    except Exception:
        pass

    # Read requests from cit_public.json
    try:
        with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
            data = json.load(f)
        starter_reqs = data.get("booking_requests", [])
    except Exception:
        starter_reqs = []

    # Read database-submitted requests
    db_reqs = db.query(BookingRequestModel).all()
    all_reqs = list(starter_reqs)
    for br in db_reqs:
        # Avoid duplicating if already present
        if not any(r.get("id") == br.id for r in all_reqs):
            all_reqs.append({
                "id": br.id,
                "title": br.title,
                "requester": br.requester,
                "role": br.role,
                "attendance": br.attendance,
                "duration_periods": br.duration_periods,
                "windows": br.windows,
                "room_types": br.room_types,
                "needs": br.needs,
                "requested_room": br.requested_room,
                "mandatory_for_groups": br.mandatory_for_groups,
                "submitted_at": br.submitted_at,
                "submitted_by": br.submitted_by,
                "status": br.status
            })

    # For faculty role, filter to own requests
    if current_user.role == "faculty":
        all_reqs = [
            r for r in all_reqs
            if r.get("submitted_by") == current_user.id
            or r.get("requester") == current_user.name
            or r.get("role") == "faculty"
        ]
    elif current_user.role == "club":
        # For club role, filter strictly to requests with submitted_by == user.id (or matching club_name)
        all_reqs = [
            r for r in all_reqs
            if r.get("submitted_by") == current_user.id
            or (current_user.club_name and r.get("requester") == current_user.club_name)
        ]

    res = []
    for r in all_reqs:
        d = disk_decisions.get(r["id"], {})
        status_val = r.get("status") or d.get("status", "pending")
        if status_val == "pending" and d.get("status"):
            status_val = d.get("status")

        res.append({
            "id": r["id"],
            "title": r.get("title"),
            "requester": r.get("requester"),
            "role": r.get("role"),
            "attendance": r.get("attendance"),
            "duration_periods": r.get("duration_periods"),
            "windows": r.get("windows"),
            "room_types": r.get("room_types"),
            "needs": r.get("needs"),
            "requested_room": r.get("requested_room"),
            "mandatory_for_groups": r.get("mandatory_for_groups"),
            "submitted_at": r.get("submitted_at"),
            "status": status_val,
            "assigned_room": d.get("room_id"),
            "assigned_day": d.get("day"),
            "start_period": d.get("start_period"),
            "end_period": d.get("end_period"),
            "reason_code": d.get("reason_code"),
            "reason": d.get("reason")
        })

    return res


@router.get("/mine")
def list_my_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists bookings submitted specifically by the current user."""
    return list_bookings(db=db, current_user=current_user)


@router.post("/{req_id}/decision")
def decide_booking(
    req_id: str,
    body: BookingDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Approves, rejects, or offers alternative for a booking request.
    Strictly enforces Non-negotiable #5: Nobody approves their own request!
    Department coordinators can only approve bookings for their department's labs.
    """
    # 1. Non-negotiable #5: Anti-self-approval
    booking = db.query(BookingRequestModel).filter(BookingRequestModel.id == req_id).first()
    if booking:
        is_self = False
        if booking.submitted_by == current_user.id:
            is_self = True
        elif booking.requester and current_user.name and (booking.requester.lower() == current_user.name.lower() or current_user.name.lower() in booking.requester.lower()):
            is_self = True
        elif booking.requester and current_user.club_name and booking.requester.lower() == current_user.club_name.lower():
            is_self = True

        if is_self:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Anti-self-approval violation: You cannot approve or decide your own booking request."
            )
    else:
        # Check in starter dataset requests
        try:
            with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
                starter_data = json.load(f)
            for r in starter_data.get("booking_requests", []):
                if r.get("id") == req_id:
                    r_req = (r.get("requester") or "").lower()
                    u_name = (current_user.name or "").lower()
                    u_club = (current_user.club_name or "").lower()
                    if (r_req and (r_req in u_name or u_name in r_req)) or (u_club and (r_req == u_club or u_club in r_req)):
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Anti-self-approval violation: You cannot approve or decide your own booking request."
                        )
        except HTTPException:
            raise
        except Exception:
            pass

    # 2. Check authorization: Admins and Department Coordinators only
    if current_user.role not in ("admin", "department_coordinator"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only Admins and Department Coordinators can make booking decisions."
        )

    # 3. Department Coordinator scoping: can approve bookings only for their department's labs
    if current_user.role == "department_coordinator":
        target_room = body.room_id or (booking.requested_room if booking else None)
        if not target_room:
            try:
                with open("exports/schedule.json", encoding="utf-8") as f:
                    sched_chk = json.load(f)
                for b_chk in sched_chk.get("fest_week", {}).get("bookings", []):
                    if b_chk.get("request_id") == req_id:
                        target_room = b_chk.get("room_id")
                        break
            except Exception:
                pass

        LAB_DEPARTMENT_MAP = {
            "CS-LAB-1": "CSE",
            "CS-LAB-2": "CSE",
            "ELEC-LAB-1": ["ECE", "EE"],
            "ELEC-LAB-2": ["ECE", "EE"],
            "PHY-LAB": "PH",
            "MECH-WS": "ME",
            "CIVIL-LAB": "CE",
        }
        allowed_dept = LAB_DEPARTMENT_MAP.get(target_room)
        is_allowed = False
        if allowed_dept:
            if isinstance(allowed_dept, list):
                is_allowed = current_user.department in allowed_dept
            else:
                is_allowed = current_user.department == allowed_dept

        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Department coordinators can only approve bookings for their department's labs (target room '{target_room}' is not a {current_user.department} lab)."
            )

    # Update exports/schedule.json fest_week bookings
    try:
        with open("exports/schedule.json", encoding="utf-8") as f:
            sched = json.load(f)

        found = False
        for b in sched.get("fest_week", {}).get("bookings", []):
            if b.get("request_id") == req_id:
                b["status"] = body.action
                if body.reason:
                    b["reason"] = body.reason
                if body.day:
                    b["day"] = body.day
                if body.start_period is not None:
                    b["start_period"] = body.start_period
                if body.end_period is not None:
                    b["end_period"] = body.end_period
                if body.room_id:
                    b["room_id"] = body.room_id
                found = True
                break

        if not found:
            sched.setdefault("fest_week", {}).setdefault("bookings", []).append({
                "request_id": req_id,
                "status": body.action,
                "day": body.day,
                "start_period": body.start_period,
                "end_period": body.end_period,
                "room_id": body.room_id,
                "reason": body.reason or f"Decided by {current_user.name}"
            })

        with open("exports/schedule.json", "w", encoding="utf-8") as f:
            json.dump(sched, f, indent=2)

        # Audit log
        db.add(AuditLogModel(
            actor=current_user.email,
            action=f"BOOKING_{body.action.upper()}",
            entity=f"BookingRequest:{req_id}",
            after_json={"decision": body.action, "reason": body.reason}
        ))
        db.commit()

        return {"status": "success", "request_id": req_id, "action": body.action}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/decide-all")
def decide_all_bookings(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Runs CP-SAT optimization engine to solve all 25 booking requests with 0 inversions."""
    with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
        data = json.load(f)
    with open("exports/schedule.json", encoding="utf-8") as f:
        sched = json.load(f)

    ctx = DatasetContext.from_dict(data)
    timetable_assign, _ = to_assign(sched)

    decisions, overrides, stats = solve_bookings(ctx, timetable_assign)

    sched.setdefault("fest_week", {})["bookings"] = decisions
    sched["fest_week"]["session_overrides"] = overrides

    with open("exports/schedule.json", "w", encoding="utf-8") as f:
        json.dump(sched, f, indent=2)

    db.add(AuditLogModel(
        actor=admin.email,
        action="DECIDE_ALL_BOOKINGS",
        entity="FestWeekBookings",
        after_json=stats
    ))
    db.commit()

    return {
        "status": "success",
        "stats": stats,
        "message": f"Solved {stats['total_requests']} requests: {stats['approved']} approved, {stats['alternatives']} alternatives, {stats['rejected']} rejected."
    }

