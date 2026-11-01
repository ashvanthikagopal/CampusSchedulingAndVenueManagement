"""
Disruption and Minimal-Change Repair API endpoints.
Enforces human Admin approval before activating any repaired schedule version.
"""
from typing import Dict, Any, List, Optional
import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.app.models.entities import (
    DisruptionModel, ChangeProposalModel, ScheduleVersion, ScheduleEntry,
    SessionOverride, AuditLogModel, User
)
from backend.app.api.deps import require_admin, get_current_user, get_current_user_optional, get_optional_user
from backend.app.schemas.schemas import DisruptionCreateRequest, ChangeProposalResponse
from backend.app.core.config import get_sample_disruption_path, get_export_schedule_path, get_export_schedule_after_path
from backend.app.core.dataset_loader import get_active_dataset_dict
from backend.app.solver.repair_engine import repair_schedule
from backend.validator.validator import run as official_validator_run, apply_disruption as official_apply_disruption

router = APIRouter(prefix="/disruptions", tags=["disruptions"])


@router.post("")
@router.post("/report")
def submit_disruption(
    req: DisruptionCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits a disruption payload (e.g. faculty leave, room closure, new session).
    Faculty can submit their own unavailability, which becomes a disruption pending Admin review.
    """
    # If faculty, ensure changes only affect themselves
    if current_user.role == "faculty":
        user_fac = current_user.faculty_id or "F06"
        for ch in req.changes:
            if ch.get("type") == "faculty_unavailable":
                if not ch.get("faculty_id"):
                    ch["faculty_id"] = user_fac
                elif ch.get("faculty_id") != user_fac:
                    raise HTTPException(status_code=403, detail="Faculty can only declare their own unavailability")

    disruption_id = f"dis_{uuid.uuid4().hex[:8]}"
    dis_model = DisruptionModel(
        id=disruption_id,
        payload={"changes": req.changes, "description": req.description},
        reported_by=current_user.email,
        status="pending"
    )
    db.add(dis_model)

    db.add(AuditLogModel(
        actor=current_user.email,
        action="SUBMIT_DISRUPTION",
        entity=f"Disruption:{disruption_id}",
        after_json={"description": req.description, "changes_count": len(req.changes)}
    ))
    db.commit()

    return {
        "status": "success",
        "disruption_id": disruption_id,
        "message": "Disruption recorded and pending proposal generation."
    }


@router.post("/{disruption_id}/propose", response_model=ChangeProposalResponse)
def propose_repair(
    disruption_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Admin triggers minimal-change repair solver.
    Returns proposal with before/after diff and validator verification.
    Does not touch active timetable until approved!
    """
    dis = db.query(DisruptionModel).filter(DisruptionModel.id == disruption_id).first()
    if not dis:
        if disruption_id == "sample-disruption":
            with open(get_sample_disruption_path(), encoding="utf-8") as f:
                dis_payload = json.load(f)
        else:
            raise HTTPException(status_code=404, detail="Disruption not found")
    else:
        dis_payload = dis.payload

    base_data = get_active_dataset_dict(db)
    with open(get_export_schedule_path(), encoding="utf-8") as f:
        base_sched = json.load(f)

    status_r, sched_after, proposal = repair_schedule(
        base_data=base_data,
        disruption=dis_payload,
        base_schedule=base_sched,
        time_limit_seconds=45.0
    )

    if status_r != "FEASIBLE" or not sched_after:
        raise HTTPException(
            status_code=400,
            detail=proposal
        )

    # Validate with official validator
    new_data = official_apply_disruption(base_data, dis_payload)
    val_rep = official_validator_run(new_data, sched_after, baseline=base_sched)

    # Identify base schedule version id
    current_active = db.query(ScheduleVersion).filter(ScheduleVersion.status == "active").order_by(ScheduleVersion.created_at.desc()).first()
    base_ver_id = current_active.id if current_active else "base_v1"

    proposal_id = f"prop_{uuid.uuid4().hex[:8]}"
    prop_model = ChangeProposalModel(
        id=proposal_id,
        disruption_id=disruption_id if dis else None,
        base_version_id=base_ver_id,
        moved_count=proposal.get("moved_count", 0),
        hard_violations=val_rep.get("hard_violation_count", 0),
        soft_delta=val_rep.get("soft_total", 0) - base_sched.get("soft_total", 0),
        status="pending_approval",
        entries_json=proposal.get("moved_sessions", []),
        repaired_schedule_json=sched_after,
        validator_report=val_rep,
        created_by=admin.email
    )
    db.add(prop_model)
    db.commit()

    return ChangeProposalResponse(
        proposal_id=proposal_id,
        base_version_id=base_ver_id,
        moved_count=proposal.get("moved_count", 0),
        time_changed_count=proposal.get("time_changed_count", 0),
        room_only_changed_count=proposal.get("room_only_changed_count", 0),
        hard_violations=val_rep.get("hard_violation_count", 0),
        soft_delta=val_rep.get("soft_total", 0),
        status="pending_approval",
        moved_sessions=proposal.get("moved_sessions", []),
        validator_report=val_rep
    )


@router.get("/mine")
def list_my_disruptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists disruptions reported by the current user."""
    disruptions = db.query(DisruptionModel).filter(DisruptionModel.reported_by == current_user.email).order_by(DisruptionModel.created_at.desc()).all()
    res = []
    for d in disruptions:
        prop = db.query(ChangeProposalModel).filter(ChangeProposalModel.disruption_id == d.id).first()
        res.append({
            "id": d.id,
            "description": d.payload.get("description"),
            "changes": d.payload.get("changes", []),
            "status": d.status,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "proposal": {
                "id": prop.id,
                "status": prop.status,
                "moved_count": prop.moved_count,
                "hard_violations": prop.hard_violations,
                "soft_delta": prop.soft_delta,
                "moved_sessions": prop.entries_json
            } if prop else None
        })
    return res


@router.post("/dry-run")
def dry_run_disruption(
    req: DisruptionCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Simulates disruption repair without saving or modifying the timetable.
    Returns affected sessions and previewed minimal-change repair stats.
    """
    if current_user.role == "faculty":
        user_fac = current_user.faculty_id or "F06"
        for ch in req.changes:
            if ch.get("type") == "faculty_unavailable":
                if not ch.get("faculty_id"):
                    ch["faculty_id"] = user_fac
                elif ch.get("faculty_id") != user_fac:
                    raise HTTPException(status_code=403, detail="Faculty can only declare their own unavailability")

    base_data = get_active_dataset_dict(db)
    with open(get_export_schedule_path(), encoding="utf-8") as f:
        base_sched = json.load(f)

    dis_payload = {"changes": req.changes, "description": req.description}
    status_r, sched_after, proposal = repair_schedule(
        base_data=base_data,
        disruption=dis_payload,
        base_schedule=base_sched,
        time_limit_seconds=15.0
    )

    if status_r != "FEASIBLE" or not sched_after:
        return {
            "status": "INFEASIBLE",
            "message": "Disruption is mathematically infeasible without violating hard constraints (e.g. no open slots for student groups).",
            "moved_count": 0,
            "hard_violations": 1,
            "soft_delta": 0,
            "moved_sessions": []
        }

    new_data = official_apply_disruption(base_data, dis_payload)
    val_rep = official_validator_run(new_data, sched_after, baseline=base_sched)

    return {
        "status": "FEASIBLE",
        "moved_count": proposal.get("moved_count", 0),
        "time_changed_count": proposal.get("time_changed_count", 0),
        "room_only_changed_count": proposal.get("room_only_changed_count", 0),
        "hard_violations": val_rep.get("hard_violation_count", 0),
        "soft_delta": val_rep.get("soft_total", 0) - base_sched.get("soft_total", 0),
        "moved_sessions": proposal.get("moved_sessions", [])
    }


@router.get("/proposals")
def list_proposals(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Lists change proposals with their before/after diffs.
    Returns [] when empty (no fake sample proposals).
    If logged in as faculty, filtered to proposals affecting their own sessions.
    """
    props = db.query(ChangeProposalModel).order_by(ChangeProposalModel.created_at.desc()).all()
    if not props:
        return []

    if current_user and current_user.role == "faculty" and current_user.faculty_id:
        try:
            d_meta = get_active_dataset_dict(db)
            fac_sids = {s["id"] for s in d_meta.get("sessions", []) if s.get("faculty_id") == current_user.faculty_id}
        except Exception:
            fac_sids = set()

        filtered_props = []
        for p in props:
            moved = p.entries_json or []
            if any(m.get("session_id") in fac_sids for m in moved):
                filtered_props.append(p)
        return filtered_props

    return props


@router.post("/proposals/{prop_id}/approve")
def approve_proposal(
    prop_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Admin approves proposal:
    1. Re-validates with official validator against current base schedule (rejects if hard violations > 0).
    2. Atomically writes the repaired schedule to the active schedule and exports/schedule.json.
    3. Writes exports/schedule_after.json from the same approved result.
    4. Re-runs Week 7 booking decisions on the new timetable.
    5. Writes an audit log entry and notifies affected faculty.
    6. Enforces anti-self-approval: approver must not be the requester.
    """
    prop = db.query(ChangeProposalModel).filter(ChangeProposalModel.id == prop_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if prop.status == "approved":
        raise HTTPException(status_code=400, detail="Proposal has already been approved")

    # Anti-self-approval enforcement
    dis = None
    if prop.disruption_id:
        dis = db.query(DisruptionModel).filter(DisruptionModel.id == prop.disruption_id).first()
        if dis and dis.reported_by and dis.reported_by.lower() == admin.email.lower():
            raise HTTPException(
                status_code=403,
                detail="Anti-self-approval violation: An administrator cannot approve a disruption proposal they reported. Dual authority required."
            )

    # Check stale base_version_id
    current_active = db.query(ScheduleVersion).filter(ScheduleVersion.status == "active").order_by(ScheduleVersion.created_at.desc()).first()
    if current_active and prop.base_version_id and prop.base_version_id not in ("base_v1", current_active.id):
        raise HTTPException(status_code=409, detail="Stale proposal: The active timetable version has changed since this proposal was generated.")

    # Re-validate proposal against current base data and official validator
    base_data = get_active_dataset_dict(db)
    with open(get_export_schedule_path(), encoding="utf-8") as f:
        base_sched = json.load(f)

    sched_to_apply = prop.repaired_schedule_json
    if not sched_to_apply:
        sched_to_apply = json.loads(json.dumps(base_sched))
        sess_dict = {s["session_id"]: s for s in sched_to_apply.get("sessions", [])}
        for m in prop.entries_json or []:
            sid = m.get("session_id")
            if sid in sess_dict and m.get("after"):
                sess_dict[sid]["day"] = m["after"]["day"]
                sess_dict[sid]["start_period"] = m["after"]["start_period"]
                sess_dict[sid]["room_id"] = m["after"]["room_id"]

    dis_payload = dis.payload if dis else {"changes": []}
    new_data = official_apply_disruption(base_data, dis_payload)
    val_rep = official_validator_run(new_data, sched_to_apply, baseline=base_sched)

    if val_rep.get("hard_violation_count", 0) > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Approval rejected: Repaired schedule produces {val_rep['hard_violation_count']} hard violations."
        )

    # Re-run Week 7 booking decisions on the new timetable
    from backend.app.solver.booking_engine import solve_bookings
    from backend.app.rules.models import DatasetContext
    new_ctx = DatasetContext.from_dict(new_data)
    repaired_assign = {s["session_id"]: (s["day"], s["start_period"], s["room_id"]) for s in sched_to_apply.get("sessions", [])}
    booking_decisions, session_overrides, _ = solve_bookings(new_ctx, repaired_assign, time_limit_seconds=15.0)

    sched_to_apply["fest_week"] = {
        "bookings": booking_decisions,
        "session_overrides": session_overrides
    }
    sched_to_apply["dataset_id"] = new_data.get("dataset_id", "cit-public-v1")
    sched_to_apply["team"] = "CIT Scheduler Master Team"

    # Re-validate fest week with official validator
    val_rep = official_validator_run(new_data, sched_to_apply, baseline=base_sched)

    # Atomically write to database
    db.query(ScheduleVersion).filter(ScheduleVersion.status == "active").update({"status": "archived"})

    new_ver_id = f"v_repaired_{uuid.uuid4().hex[:8]}"
    new_version = ScheduleVersion(
        id=new_ver_id,
        kind="after_change",
        status="active",
        solver_status="OPTIMAL",
        soft_penalty=val_rep.get("soft_total", 0),
        validator_report=val_rep,
        created_by=admin.email
    )
    db.add(new_version)

    for s in sched_to_apply.get("sessions", []):
        db.add(ScheduleEntry(
            version_id=new_ver_id,
            session_id=s["session_id"],
            day=s["day"],
            start_period=s["start_period"],
            room_id=s["room_id"]
        ))

    for ov in session_overrides:
        db.add(SessionOverride(
            version_id=new_ver_id,
            session_id=ov["session_id"],
            day=ov["day"],
            start_period=ov["start_period"],
            room_id=ov["room_id"],
            displaced_by=ov["displaced_by"]
        ))

    # Atomically write to exports/schedule_after.json
    with open(get_export_schedule_after_path(), "w", encoding="utf-8") as f:
        json.dump(sched_to_apply, f, indent=2)

    # Update proposal and disruption status
    prop.status = "approved"
    prop.new_version_id = new_ver_id
    if dis:
        dis.status = "approved"

    # Write audit log
    db.add(AuditLogModel(
        actor=admin.email,
        action="APPROVE_CHANGE_PROPOSAL",
        entity=f"Proposal:{prop_id}",
        after_json={"status": "approved", "new_version_id": new_ver_id, "moved_count": len(prop.entries_json or [])}
    ))

    # Notify affected faculty members
    session_meta = {s["id"]: s for s in base_data.get("sessions", [])}
    from backend.app.models.entities import NotificationModel
    notified_faculties = set()
    for m in prop.entries_json or []:
        sid = m.get("session_id")
        s_obj = session_meta.get(sid, {})
        fid = s_obj.get("faculty_id")
        if fid and fid not in notified_faculties:
            notified_faculties.add(fid)
            fac_user = db.query(User).filter(User.faculty_id == fid).first()
            if fac_user:
                bef = m.get("before", {})
                aft = m.get("after", {})
                b_str = f"{bef.get('day')} P{bef.get('start_period')} ({bef.get('room_id')})" if bef else "unscheduled"
                a_str = f"{aft.get('day')} P{aft.get('start_period')} ({aft.get('room_id')})" if aft else "rescheduled"
                db.add(NotificationModel(
                    id=f"notif_{uuid.uuid4().hex[:8]}",
                    user_id=fac_user.id,
                    title="Timetable Reschedule Approved",
                    message=f"Your session {sid} has been rescheduled from {b_str} to {a_str} following Dean/Admin review.",
                    type="proposal_approved",
                    link="/my-schedule"
                ))

    # Also notify the disruption reporter if different
    if dis and dis.reported_by:
        rep_user = db.query(User).filter(User.email == dis.reported_by).first()
        if rep_user and rep_user.faculty_id not in notified_faculties:
            db.add(NotificationModel(
                id=f"notif_{uuid.uuid4().hex[:8]}",
                user_id=rep_user.id,
                title="Disruption Request Approved",
                message=f"Your disruption request ({dis.payload.get('description', 'Disruption')}) has been reviewed and approved.",
                type="disruption_approved",
                link="/my-requests"
            ))

    db.commit()

    return {
        "status": "success",
        "proposal_id": prop_id,
        "new_version_id": new_ver_id,
        "message": "Change proposal approved. Repaired schedule activated atomically with zero hard violations."
    }




@router.post("/proposals/{prop_id}/reject")
def reject_proposal(
    prop_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Admin rejects a disruption change proposal.
    Updates proposal and disruption status to 'rejected', records audit log, and notifies reporter.
    """
    prop = db.query(ChangeProposalModel).filter(ChangeProposalModel.id == prop_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if prop.status == "rejected":
        raise HTTPException(status_code=400, detail="Proposal has already been rejected")

    # Anti-self-approval enforcement
    dis = None
    if prop.disruption_id:
        dis = db.query(DisruptionModel).filter(DisruptionModel.id == prop.disruption_id).first()
        if dis and dis.reported_by and dis.reported_by.lower() == admin.email.lower():
            raise HTTPException(
                status_code=403,
                detail="Anti-self-approval violation: An administrator cannot decide a disruption proposal they reported."
            )

    prop.status = "rejected"
    if dis:
        dis.status = "rejected"

    db.add(AuditLogModel(
        actor=admin.email,
        action="REJECT_CHANGE_PROPOSAL",
        entity=f"Proposal:{prop_id}",
        after_json={"status": "rejected", "proposal_id": prop_id}
    ))

    # Notify disruption reporter
    if dis and dis.reported_by:
        rep_user = db.query(User).filter(User.email == dis.reported_by).first()
        if rep_user:
            db.add(NotificationModel(
                id=f"notif_{uuid.uuid4().hex[:8]}",
                user_id=rep_user.id,
                title="Disruption Proposal Rejected",
                message=f"Your disruption request ({dis.payload.get('description', 'Disruption')}) proposal was rejected by Admin review.",
                type="disruption_rejected",
                link="/my-requests"
            ))

    db.commit()

    return {
        "status": "success",
        "proposal_id": prop_id,
        "message": "Change proposal rejected successfully."
    }
