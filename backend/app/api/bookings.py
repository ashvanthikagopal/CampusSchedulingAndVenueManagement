"""
Spectra Week and Venue Bookings API endpoints.
Strictly enforces server-side role capping and anti-self-approval checks.
"""
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import json

from backend.app.database.session import get_db
from backend.app.models.entities import (
    BookingRequestModel, BookingDecisionModel, User, AuditLogModel, DatasetModel, RoomModel, PriorityConfigModel
)
from backend.app.api.deps import get_current_user, require_admin
from backend.app.core.config import get_export_schedule_path, get_starter_dataset_path
from backend.app.core.dataset_loader import get_active_dataset_dict
from backend.app.schemas.schemas import (
    BookingCreateRequest, BookingParseRequest, BookingParseResponse,
    BookingCheckRequest, BookingCheckResponse, BookingDecisionRequest
)
from backend.app.ai.parser import parse_booking_text
from backend.app.rules.models import DatasetContext, BookingRequest as RuleBookingRequest, effective_category
from backend.app.rules.bookings import validate_single_booking
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
    """Dry-run deterministic validation of a booking request against all 14 criteria (Issue C)."""
    data = get_active_dataset_dict(db)
    ctx = DatasetContext.from_dict(data)

    p_config = db.query(PriorityConfigModel).first()
    if p_config and p_config.priority_order:
        ctx.priority_order = p_config.priority_order

    try:
        with open(get_export_schedule_path(), encoding="utf-8") as f:
            sched = json.load(f)
        timetable_assign, _ = to_assign(sched)
        existing_decisions = sched.get("fest_week", {}).get("bookings", [])
    except Exception:
        timetable_assign = {}
        existing_decisions = []

    booking_dict = check_req.booking.model_dump()
    res = validate_single_booking(
        ctx=ctx,
        base_assign=timetable_assign,
        booking_dict=booking_dict,
        existing_decisions=existing_decisions,
        user_role=current_user.role,
        priority_order=ctx.priority_order
    )

    return BookingCheckResponse(
        pass_validation=res["pass"],
        reason_code=res["reason_code"],
        reason=res["reason"],
        suggested_alternative=res.get("suggested_alternative")
    )


@router.post("/{req_id}/cancel")
def cancel_booking(
    req_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancels a pending booking request:
    - Club Representatives can cancel their own pending venue requests.
    - Attempting to cancel another club's request returns HTTP 403.
    - Only permitted while request status is 'pending'.
    """
    booking = db.query(BookingRequestModel).filter(BookingRequestModel.id == req_id).first()

    # Ownership & Scoping Check
    if current_user.role == "club":
        is_owner = False
        if booking and booking.submitted_by == current_user.id:
            is_owner = True
        elif booking and current_user.club_name and (booking.requester.lower() == current_user.club_name.lower() or current_user.club_name.lower() in booking.requester.lower()):
            is_owner = True
        elif not booking:
            starter_data = get_active_dataset_dict(db)
            for r in starter_data.get("booking_requests", []):
                if r.get("id") == req_id:
                    req_name = (r.get("requester") or "").lower()
                    if current_user.club_name and (current_user.club_name.lower() in req_name or req_name in current_user.club_name.lower()):
                        is_owner = True
                    break
        if not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Club scoping violation: You can only cancel booking requests belonging to your own club."
            )
    elif current_user.role in ("department_coordinator", "faculty"):
        if booking and booking.submitted_by != current_user.id and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only cancel your own booking requests."
            )

    # Check status: only pending requests can be cancelled
    current_status = booking.status if booking else "pending"
    if current_status not in ("pending", None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel booking with status '{current_status}'. Only pending requests can be cancelled."
        )

    if booking:
        booking.status = "cancelled"
    else:
        db.add(BookingRequestModel(
            id=req_id,
            submitted_at=datetime.now(timezone.utc).isoformat(),
            requester=current_user.name,
            role=current_user.role,
            requested_category="club_event",
            effective_category="club_event",
            title=f"Request {req_id}",
            attendance=50,
            duration_periods=1,
            status="cancelled",
            submitted_by=current_user.id
        ))

    sched_path = get_export_schedule_path()
    try:
        with open(sched_path, encoding="utf-8") as f:
            sched = json.load(f)
        for b in sched.get("fest_week", {}).get("bookings", []):
            if b.get("request_id") == req_id:
                b["status"] = "cancelled"
                b["reason"] = f"Cancelled by requester ({current_user.name})"
                break
        with open(sched_path, "w", encoding="utf-8") as f:
            json.dump(sched, f, indent=2)
    except Exception:
        pass

    db.add(AuditLogModel(
        actor=current_user.email,
        action="CANCEL_BOOKING",
        entity=f"BookingRequest:{req_id}",
        after_json={"status": "cancelled", "cancelled_by": current_user.email}
    ))
    db.commit()

    return {
        "status": "success",
        "request_id": req_id,
        "message": f"Booking request {req_id} cancelled successfully."
    }


@router.post("")
def create_booking(booking: BookingCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Submits a new booking request. Effective category is computed server-side."""
    # Server-side category cap: Non-negotiable #1
    req_cat = booking.requested_category or "club_event"
    eff_cat, rule_trace = compute_effective_category(req_cat, current_user.role)

    import uuid
    req_id = f"BR-REQ-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"

    new_b = BookingRequestModel(
        id=req_id,
        submitted_at=datetime.now(timezone.utc).isoformat() + "+05:30",
        requester=current_user.name,
        role=current_user.role,
        requested_category=req_cat,
        effective_category=eff_cat,
        title=booking.title,
        attendance=booking.attendance,
        duration_periods=booking.duration_periods,
        windows=[w.model_dump() for w in booking.windows],
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
        with open(get_export_schedule_path(), encoding="utf-8") as f:
            sched = json.load(f)
        for d in sched.get("fest_week", {}).get("bookings", []):
            disk_decisions[d["request_id"]] = d
    except Exception:
        pass

    # Read requests from cit_public.json
    try:
        with open(get_starter_dataset_path(), encoding="utf-8") as f:
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
            with open(get_starter_dataset_path(), encoding="utf-8") as f:
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
                with open(get_export_schedule_path(), encoding="utf-8") as f:
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

        # Department Coordinators cannot approve bookings requiring a regular class to be moved!
        # Check if target room on target day/period has an existing regular class
        try:
            with open(get_export_schedule_path(), encoding="utf-8") as f:
                _cur_sched = json.load(f)
            _t_day = body.day or (booking.windows[0]["day"] if booking and booking.windows else "WED")
            _t_start = body.start_period or (booking.windows[0]["from_period"] if booking and booking.windows else 1)
            _t_dur = (body.end_period - body.start_period + 1) if (body.start_period and body.end_period) else (booking.duration_periods if booking else 1)
            _t_end = body.end_period or (_t_start + _t_dur - 1)
            for _sess in _cur_sched.get("sessions", []):
                if _sess.get("room_id") == target_room and _sess.get("day") == _t_day:
                    _s_start = _sess.get("start_period", 1)
                    _s_dur = 1
                    # check overlap
                    if not (_t_end < _s_start or _t_start > _s_start):
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Department Coordinator cannot approve bookings requiring an existing class to be moved. Escalated to Admin approval required."
                        )
        except HTTPException:
            raise
        except Exception:
            pass

    # Read active schedule and dataset
    try:
        sched_path = get_export_schedule_path()
        with open(sched_path, encoding="utf-8") as f:
            sched = json.load(f)

        data = get_active_dataset_dict(db)
        ctx = DatasetContext.from_dict(data)
        p_config = db.query(PriorityConfigModel).first()
        if p_config and p_config.priority_order:
            ctx.priority_order = p_config.priority_order
        timetable_assign, _ = to_assign(sched)

        # Before approving or offering alternative, validate complete resulting schedule (Issue C)
        if body.action in ("approve", "alternative_offered"):
            b_dur = (body.end_period - body.start_period + 1) if (body.start_period and body.end_period) else (booking.duration_periods if booking else 1)
            target_r = body.room_id or (booking.requested_room if booking else None)
            target_d = body.day or (booking.windows[0]["day"] if booking and booking.windows else "WED")
            target_s = body.start_period or (booking.windows[0]["from_period"] if booking and booking.windows else 1)
            target_e = body.end_period or (target_s + b_dur - 1)

            check_data = {
                "id": req_id,
                "requested_room": target_r,
                "windows": [{"day": target_d, "from_period": target_s, "to_period": target_e}],
                "duration_periods": b_dur,
                "attendance": booking.attendance if booking else 50,
                "room_types": booking.room_types if booking else [],
                "needs": booking.needs if booking else [],
                "mandatory_for_groups": booking.mandatory_for_groups if booking else [],
                "requested_category": booking.requested_category if booking else "club_event"
            }
            existing_decs = [b for b in sched.get("fest_week", {}).get("bookings", []) if b.get("request_id") != req_id]
            val_chk = validate_single_booking(
                ctx=ctx,
                base_assign=timetable_assign,
                booking_dict=check_data,
                existing_decisions=existing_decs,
                user_role=booking.role if booking else "club",
                priority_order=ctx.priority_order
            )
            if not val_chk["pass"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot {body.action} booking: {val_chk['reason']} (Violation: {val_chk['reason_code']})"
                )

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

        with open(get_export_schedule_path(), "w", encoding="utf-8") as f:
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
    """Runs CP-SAT optimization engine to solve all booking requests with 0 inversions and admin priority."""
    data = get_active_dataset_dict(db)
    ctx = DatasetContext.from_dict(data)

    p_config = db.query(PriorityConfigModel).first()
    if p_config and p_config.priority_order:
        ctx.priority_order = p_config.priority_order

    sched_path = get_export_schedule_path()
    with open(sched_path, encoding="utf-8") as f:
        sched = json.load(f)

    timetable_assign, _ = to_assign(sched)
    decisions, overrides, stats = solve_bookings(ctx, timetable_assign)

    sched.setdefault("fest_week", {})["bookings"] = decisions
    sched["fest_week"]["session_overrides"] = overrides

    with open(get_export_schedule_path(), "w", encoding="utf-8") as f:
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

