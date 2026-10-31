"""
Session Requests API endpoints (Move existing session or Request extra session).
Faculty can submit requests for admin review.
"""
from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from backend.app.database.session import get_db
from backend.app.models.entities import SessionRequestModel, User, AuditLogModel
from backend.app.api.deps import get_current_user
from backend.app.schemas.schemas import SessionRequestCreate, SessionRequestItem

router = APIRouter(prefix="/session-requests", tags=["session-requests"])


@router.post("", response_model=SessionRequestItem)
def submit_session_request(
    req: SessionRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits a request to move an existing session or schedule an extra class session.
    Faculty can only submit for their own faculty_id.
    Never auto-approves: queues for admin review.
    """
    if current_user.role == "faculty" and not current_user.faculty_id:
        raise HTTPException(status_code=403, detail="Faculty ID is required on user account")

    req_id = f"sreq_{uuid.uuid4().hex[:8]}"
    model = SessionRequestModel(
        id=req_id,
        faculty_id=current_user.faculty_id or "F01",
        course_id=req.course_id,
        kind=req.kind,
        duration=req.duration,
        groups=req.groups,
        preferred_windows=req.preferred_windows,
        reason=req.reason,
        request_type=req.request_type,
        target_session_id=req.target_session_id,
        status="pending",
        submitted_by=current_user.id
    )
    db.add(model)
    db.add(AuditLogModel(
        actor=current_user.email,
        action="SUBMIT_SESSION_REQUEST",
        entity=f"SessionRequest:{req_id}",
        after_json={"course_id": req.course_id, "type": req.request_type}
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
        created_at=model.created_at.isoformat() if model.created_at else None
    )


@router.get("/mine", response_model=List[SessionRequestItem])
def list_my_session_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists session requests submitted by the current user."""
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
            created_at=r.created_at.isoformat() if r.created_at else None
        )
        for r in reqs
    ]

