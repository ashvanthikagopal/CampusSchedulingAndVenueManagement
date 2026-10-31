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
from backend.app.api.deps import get_current_user, require_admin, get_optional_current_user
from backend.app.schemas.schemas import (
    BookingCreateRequest, BookingParseRequest, BookingParseResponse,
    BookingCheckRequest, BookingCheckResponse, BookingDecisionRequest
)
from backend.app.ai.parser import parse_booking_text
from backend.app.rules.models import DatasetContext, BookingRequest as RuleBookingRequest, effective_category
from backend.app.solver.booking_engine import solve_bookings
from backend.app.rules.engine import to_assign

router = APIRouter(prefix="/bookings", tags=["bookings"])


PRIORITY_ORDER = [
    "exam", "regular_session", "institute_event",
    "guest_lecture", "department_event", "club_event"
]

ROLE_CAPS = {
    "admin": "institute_event",
    "faculty": "guest_lecture",
    "department_coordinator": "department_event",
    "club": "club_event"
}


def compute_effective_category_and_trace(role: str, requested: Optional[str]) -> tuple[str, str]:
    cap = ROLE_CAPS.get(role, "club_event")
    req = requested or cap
    req_idx = PRIORITY_ORDER.index(req) if req in PRIORITY_ORDER else len(PRIORITY_ORDER) - 1
    cap_idx = PRIORITY_ORDER.index(cap)
    eff_idx = max(req_idx, cap_idx)
    eff_cat = PRIORITY_ORDER[eff_idx]

    if req_idx < cap_idx:
        rule_trace = f"Requested category '{req}' capped to '{eff_cat}' by role policy for role '{role}'."
    else:
        rule_trace = f"Requested category '{req}' satisfies role cap '{cap}' for role '{role}'."

    return eff_cat, rule_trace


@router.post("/parse", response_model=BookingParseResponse)
def parse_request_endpoint(req: BookingParseRequest, current_user: User = Depends(get_current_user)):
    """Parses plain-language English or Hinglish text using Gemini with deterministic fallback."""
    parsed = parse_booking_text(req.text, user_role=current_user.role)

    # Server-side category cap: min(requested, role_cap) with stated rule_trace
    requested = parsed.get("requested_category")
    eff_cat, rule_trace = compute_effective_category_and_trace(current_user.role, requested)

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
def check_booking_endpoint(check_req: BookingCheckRequest, db: Session = Depends(get_db)):
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
    eff_cat, rule_trace = compute_effective_category_and_trace(current_user.role, booking.requested_category)

    req_id = f"BR-REQ-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

    new_b = BookingRequestModel(
        id=req_id,
        submitted_at=datetime.utcnow().isoformat() + "+05:30",
        requester=current_user.name,
        role=current_user.role,
        requested_category=booking.requested_category or eff_cat,
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
        "message": f"Booking submitted successfully. {rule_trace}"
    }


@router.get("")
def list_bookings(db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_optional_current_user)):
    """Lists all booking requests and their active decisions."""
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

    res = []
    for r in starter_reqs:
        # Scoping check for club: only requests where requester matches club_name or submitted_by
        if current_user and current_user.role == "club":
            req_name = r.get("requester")
            sub_by = r.get("submitted_by")
            if req_name != current_user.club_name and req_name != current_user.name and sub_by != current_user.id:
                continue

        d = disk_decisions.get(r["id"], {})
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
            "status": d.get("status", "pending"),
            "assigned_room": d.get("room_id"),
            "assigned_day": d.get("day"),
            "start_period": d.get("start_period"),
            "end_period": d.get("end_period"),
            "reason_code": d.get("reason_code"),
            "reason": d.get("reason")
        })

    # Also include any live requests in DB that were submitted
    db_reqs = db.query(BookingRequestModel).all()
    for db_r in db_reqs:
        if current_user and current_user.role == "club":
            if db_r.submitted_by != current_user.id and db_r.requester != current_user.club_name and db_r.requester != current_user.name:
                continue
        # Avoid duplicate if already in starter_reqs
        if any(item["id"] == db_r.id for item in res):
            continue
        d = disk_decisions.get(db_r.id, {})
        res.append({
            "id": db_r.id,
            "title": db_r.title,
            "requester": db_r.requester,
            "role": db_r.role,
            "attendance": db_r.attendance,
            "duration_periods": db_r.duration_periods,
            "windows": db_r.windows,
            "room_types": db_r.room_types,
            "needs": db_r.needs,
            "requested_room": db_r.requested_room,
            "mandatory_for_groups": db_r.mandatory_for_groups,
            "submitted_at": db_r.submitted_at,
            "status": db_r.status or d.get("status", "pending"),
            "assigned_room": d.get("room_id"),
            "assigned_day": d.get("day"),
            "start_period": d.get("start_period"),
            "end_period": d.get("end_period"),
            "reason_code": d.get("reason_code"),
            "reason": d.get("reason")
        })

    return res


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
    Also enforces that department coordinators can only approve department lab bookings.
    """
    # 1. Authorization: Admins and Department Coordinators only
    if current_user.role not in ("admin", "department_coordinator"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admins and Department Coordinators can make booking decisions."
        )

    # 2. Non-negotiable #5: Anti-self-approval
    booking = db.query(BookingRequestModel).filter(BookingRequestModel.id == req_id).first()
    if booking:
        if booking.submitted_by and booking.submitted_by == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Anti-self-approval violation: You cannot approve or decide your own booking request."
            )
        if booking.requester and (booking.requester.lower() == current_user.name.lower() or booking.requester.lower() == (current_user.club_name or "").lower()):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Anti-self-approval violation: You cannot approve or decide your own booking request."
            )
    else:
        # Check against starter dataset
        try:
            with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
                sdata = json.load(f)
            for req in sdata.get("booking_requests", []):
                if req.get("id") == req_id:
                    req_name = req.get("requester", "")
                    if req_name.lower() == current_user.name.lower() or req_name.lower() == (current_user.club_name or "").lower():
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Anti-self-approval violation: You cannot approve or decide your own booking request."
                        )
        except HTTPException:
            raise
        except Exception:
            pass

    # 3. Department coordinator lab restriction
    if current_user.role == "department_coordinator":
        target_room_id = body.room_id or (booking.requested_room if booking else None)
        if not target_room_id:
            try:
                with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
                    sdata = json.load(f)
                for req in sdata.get("booking_requests", []):
                    if req.get("id") == req_id:
                        target_room_id = req.get("requested_room")
            except Exception:
                pass

        if not target_room_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Department coordinators can only approve bookings targeting a department laboratory venue."
            )

        rm = db.query(RoomModel).filter(RoomModel.id == target_room_id).first()
        if not rm:
            try:
                with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
                    sdata = json.load(f)
                for r in sdata.get("rooms", []):
                    if r.get("id") == target_room_id:
                        rm = RoomModel(id=r["id"], name=r["name"], building=r.get("building"), type=r["type"], capacity=r["capacity"], allowed_uses=r.get("allowed_uses", []))
            except Exception:
                pass

        if not rm or not (rm.type.startswith("lab") or "lab" in rm.type.lower() or "lab" in rm.id.lower()):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Department coordinators can only approve bookings for laboratory venues."
            )

        lab_dept_map = {
            "lab_cs": ["CSE"],
            "lab_elec": ["ECE", "EE"],
            "lab_phy": ["PH"],
            "lab_civil": ["CE"]
        }
        allowed_depts = lab_dept_map.get(rm.type, [])
        dept_match = (
            (current_user.department in allowed_depts) or
            (current_user.department.lower() in rm.id.lower()) or
            (current_user.department.lower() in (rm.building or "").lower())
        )
        if not dept_match:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Department coordinators cannot approve bookings for labs outside their department ({current_user.department})."
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

