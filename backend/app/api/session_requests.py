"""
Session Requests API endpoints (Move existing session or Request extra session).
Enforces strict Section 4 role scoping:
- Faculty can only request moves/extras for their own assigned sessions.
- Department Coordinators can request moves/extras for sessions in their department.
- Club Representatives are strictly forbidden from submitting session requests.
- Admin and authorized Coordinators review and approve/reject requests with anti-self-approval.
"""
from typing import List, Optional
import uuid
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.app.models.entities import (
    SessionRequestModel, User, AuditLogModel, ScheduleVersion, ScheduleEntry,
    NotificationModel
)
from backend.app.api.deps import get_current_user, require_admin_or_coordinator
from backend.app.core.config import get_export_schedule_path
from backend.app.core.dataset_loader import get_active_dataset_dict
from backend.app.schemas.schemas import (
    SessionRequestCreate, SessionRequestItem, SessionRequestDecisionRequest
)
from backend.app.rules.models import DatasetContext
from backend.app.rules.faculty_checks import check_candidate_move

router = APIRouter(prefix="/session-requests", tags=["session-requests"])


@router.post("", response_model=SessionRequestItem)
def submit_session_request(
    req: SessionRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits a request to move an existing session or schedule an extra class session.
    - Faculty: can only submit for their own faculty_id and assigned sessions.
    - Department Coordinator: can submit for sessions within their department.
    - Admin: can submit for any session.
    - Club Representative: 403 Forbidden.
    """
    if current_user.role == "club":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Club Representatives cannot modify timetable sessions or request academic classes."
        )

    data = get_active_dataset_dict(db)
    ctx = DatasetContext.from_dict(data)

    target_fac = None
    target_dept = None

    if req.target_session_id:
        sess = ctx.sessions.get(req.target_session_id)
        if not sess:
            raise HTTPException(status_code=404, detail=f"Target session '{req.target_session_id}' not found in dataset")
        target_fac = sess.faculty_id
        # Derive department from groups or faculty
        fac_obj = ctx.faculty.get(sess.faculty_id)
        target_dept = fac_obj.department if fac_obj else None

    # Role Scoping Verification
    if current_user.role == "faculty":
        if not current_user.faculty_id:
            raise HTTPException(status_code=403, detail="Faculty ID is missing on your account")
        if req.target_session_id and target_fac != current_user.faculty_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Faculty scoping violation: You are authenticated as {current_user.faculty_id} and can only request changes to your own assigned sessions (target session belongs to {target_fac})."
            )
        assigned_fac = current_user.faculty_id
        assigned_dept = current_user.department or target_dept
    elif current_user.role == "department_coordinator":
        if not current_user.department:
            raise HTTPException(status_code=403, detail="Department is not assigned to coordinator account")
        if target_dept and target_dept != current_user.department:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Department scoping violation: You can only request changes for sessions in your department ({current_user.department})."
            )
        assigned_fac = target_fac or "F01"
        assigned_dept = current_user.department
    else:  # admin
        assigned_fac = target_fac or "F01"
        assigned_dept = target_dept or "Administration"

    req_id = f"sreq_{uuid.uuid4().hex[:8]}"
    model = SessionRequestModel(
        id=req_id,
        faculty_id=assigned_fac,
        course_id=req.course_id,
        kind=req.kind,
        duration=req.duration,
        groups=req.groups,
        preferred_windows=req.preferred_windows,
        reason=req.reason,
        request_type=req.request_type,
        target_session_id=req.target_session_id,
        status="pending",
        submitted_by=current_user.id,
        department=assigned_dept,
        created_at=datetime.now(timezone.utc)
    )
    db.add(model)
    db.add(AuditLogModel(
        actor=current_user.email,
        action="SUBMIT_SESSION_REQUEST",
        entity=f"SessionRequest:{req_id}",
        after_json={
            "course_id": req.course_id,
            "type": req.request_type,
            "target_session_id": req.target_session_id,
            "department": assigned_dept
        }
    ))
    db.commit()

    return SessionRequestItem(
        id=model.id,
        faculty_id=model.faculty_id,
        course_id=model.course_id,
        kind=model.kind,
        duration=model.duration,
        groups=model.groups or [],
        preferred_windows=model.preferred_windows or [],
        reason=model.reason,
        request_type=model.request_type,
        target_session_id=model.target_session_id,
        status=model.status,
        submitted_by=model.submitted_by,
        department=model.department,
        assigned_approver=model.assigned_approver,
        decision_reason=model.decision_reason,
        decided_at=model.decided_at.isoformat() if model.decided_at else None,
        created_at=model.created_at.isoformat() if model.created_at else None
    )


@router.get("", response_model=List[SessionRequestItem])
def list_session_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists pending and decided session requests for administrative review.
    - Admin: sees all session requests across all departments.
    - Department Coordinator: sees requests for their department.
    - Faculty & Club: 403 Forbidden (use /session-requests/mine).
    """
    if current_user.role not in ("admin", "department_coordinator"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Session request queue is restricted to Admin and Department Coordinators. Use /session-requests/mine to view your own."
        )

    query = db.query(SessionRequestModel)
    if current_user.role == "department_coordinator":
        query = query.filter(SessionRequestModel.department == current_user.department)

    reqs = query.order_by(SessionRequestModel.created_at.desc()).all()
    return [
        SessionRequestItem(
            id=r.id,
            faculty_id=r.faculty_id,
            course_id=r.course_id,
            kind=r.kind,
            duration=r.duration,
            groups=r.groups or [],
            preferred_windows=r.preferred_windows or [],
            reason=r.reason,
            request_type=r.request_type,
            target_session_id=r.target_session_id,
            status=r.status,
            submitted_by=r.submitted_by,
            department=r.department,
            assigned_approver=r.assigned_approver,
            decision_reason=r.decision_reason,
            decided_at=r.decided_at.isoformat() if r.decided_at else None,
            created_at=r.created_at.isoformat() if r.created_at else None
        )
        for r in reqs
    ]


@router.get("/mine", response_model=List[SessionRequestItem])
def list_my_session_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists session requests submitted by the logged-in user."""
    reqs = db.query(SessionRequestModel).filter(
        SessionRequestModel.submitted_by == current_user.id
    ).order_by(SessionRequestModel.created_at.desc()).all()

    return [
        SessionRequestItem(
            id=r.id,
            faculty_id=r.faculty_id,
            course_id=r.course_id,
            kind=r.kind,
            duration=r.duration,
            groups=r.groups or [],
            preferred_windows=r.preferred_windows or [],
            reason=r.reason,
            request_type=r.request_type,
            target_session_id=r.target_session_id,
            status=r.status,
            submitted_by=r.submitted_by,
            department=r.department,
            assigned_approver=r.assigned_approver,
            decision_reason=r.decision_reason,
            decided_at=r.decided_at.isoformat() if r.decided_at else None,
            created_at=r.created_at.isoformat() if r.created_at else None
        )
        for r in reqs
    ]


@router.post("/{req_id}/decision")
def decide_session_request(
    req_id: str,
    body: SessionRequestDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Approves or rejects a session request:
    - Enforces Anti-self-approval: Nobody can approve their own request!
    - Admin can approve/reject any request.
    - Department Coordinator can approve/reject requests within their department.
    - Re-validates against hard constraints: invalid schedule changes are never committed.
    - Atomically updates schedule entries, exports/schedule.json, audit log, and notifies requester.
    """
    if current_user.role not in ("admin", "department_coordinator"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Session request decisions are restricted to Admin and Department Coordinators."
        )

    model = db.query(SessionRequestModel).filter(SessionRequestModel.id == req_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Session request not found")

    # Anti-self-approval
    if model.submitted_by == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anti-self-approval violation: You cannot approve or decide your own session request."
        )

    # Scoping check for department coordinator
    if current_user.role == "department_coordinator":
        if model.department and model.department != current_user.department:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Department coordinators can only decide requests within their department ({current_user.department})."
            )

    action = body.action.lower()
    if action not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Action must be 'approved' or 'rejected'")

    data = get_active_dataset_dict(db)
    sched_path = get_export_schedule_path()
    try:
        with open(sched_path, encoding="utf-8") as f:
            sched = json.load(f)
    except Exception:
        sched = {"sessions": []}

    if action == "approved" and model.request_type == "move" and model.target_session_id:
        # Determine candidate move
        target_day = body.day
        target_period = body.start_period
        target_room = body.room_id

        if not (target_day and target_period and target_room):
            # Pick from preferred windows if provided
            if model.preferred_windows:
                pw = model.preferred_windows[0]
                target_day = pw.get("day")
                target_period = pw.get("from_period")
                target_room = pw.get("room_id")

        if not (target_day and target_period and target_room):
            raise HTTPException(
                status_code=400,
                detail="Move approval requires target day, start_period, and room_id"
            )

        ctx = DatasetContext.from_dict(data)
        base_assign = {
            item["session_id"]: (item["day"], item["start_period"], item["room_id"])
            for item in sched.get("sessions", [])
        }

        # Check candidate move against deterministic rules
        res = check_candidate_move(
            ctx=ctx,
            base_assign=base_assign,
            session_id=model.target_session_id,
            target_day=target_day,
            target_period=target_period,
            target_room=target_room,
            approved_bookings=[]
        )

        if not res["valid"]:
            raise HTTPException(
                status_code=400,
                detail=f"Approval rejected: proposed move violates constraint {res['hard_violation_code']}: {res['hard_violation_detail']}"
            )

        # Apply move to sessions
        for s in sched.get("sessions", []):
            if s["session_id"] == model.target_session_id:
                s["day"] = target_day
                s["start_period"] = target_period
                s["room_id"] = target_room
                break

        # Sync disk
        with open(sched_path, "w", encoding="utf-8") as f:
            json.dump(sched, f, indent=2)

        # Sync database ScheduleEntry
        active_version = db.query(ScheduleVersion).filter(ScheduleVersion.status == "active").order_by(ScheduleVersion.created_at.desc()).first()
        if active_version:
            entry = db.query(ScheduleEntry).filter(
                ScheduleEntry.version_id == active_version.id,
                ScheduleEntry.session_id == model.target_session_id
            ).first()
            if entry:
                entry.day = target_day
                entry.start_period = target_period
                entry.room_id = target_room

    model.status = action
    model.assigned_approver = current_user.name
    model.decision_reason = body.reason or f"Decided by {current_user.name} ({current_user.role})"
    model.decided_at = datetime.now(timezone.utc)

    # In-app notification to requester
    req_user = db.query(User).filter(User.id == model.submitted_by).first()
    if req_user:
        db.add(NotificationModel(
            id=f"notif_{uuid.uuid4().hex[:8]}",
            user_id=req_user.id,
            title=f"Session Request {action.capitalize()}",
            message=f"Your request for {model.course_id} ({model.request_type}) has been {action}: {model.decision_reason}",
            type="session_request_decided",
            link="/my-requests"
        ))

    db.add(AuditLogModel(
        actor=current_user.email,
        action=f"SESSION_REQUEST_{action.upper()}",
        entity=f"SessionRequest:{req_id}",
        after_json={"status": action, "reason": model.decision_reason}
    ))
    db.commit()

    return {
        "status": "success",
        "request_id": req_id,
        "action": action,
        "reason": model.decision_reason
    }
