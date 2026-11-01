"""
Admin & Analytics API endpoints: dashboard KPIs, room utilization, audit logs,
priority configuration, and idempotent demo data reset.
"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import json

from backend.app.database.session import get_db, Base, engine
from backend.app.models.entities import (
    User, RoomModel, SessionModel, BookingRequestModel, ScheduleVersion,
    AuditLogModel, PriorityConfigModel, DatasetModel
)
from backend.app.api.deps import require_admin, get_current_user
from backend.app.core.config import get_export_schedule_path, get_starter_dataset_path
from backend.app.core.dataset_loader import get_active_dataset_dict
from backend.app.schemas.schemas import DashboardMetrics, PriorityUpdateRequest

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard", response_model=DashboardMetrics)
def get_dashboard_metrics(db: Session = Depends(get_db)):
    """Provides high-level dashboard KPIs dynamically computed from the active schedule and dataset."""
    data = get_active_dataset_dict(db)

    try:
        with open(get_export_schedule_path(), encoding="utf-8") as f:
            sched = json.load(f)
    except Exception:
        sched = {"sessions": [], "fest_week": {"bookings": []}}

    total_sessions = len(data.get("sessions", []))
    sessions_count = len(sched.get("sessions", []))
    bookings = sched.get("fest_week", {}).get("bookings", [])
    approved_b = sum(1 for b in bookings if b.get("status") == "approved")
    pending_b = sum(1 for b in bookings if b.get("status") == "pending")

    # Run official validator dynamically to get ground truth metrics
    from backend.validator.validator import run as official_validator_run
    try:
        val_rep = official_validator_run(data, sched)
        hard_conflicts = val_rep.get("hard_violation_count", 0)
        soft_total = val_rep.get("soft_total", 0)
        b_score = float(val_rep.get("bookings", {}).get("booking_score", val_rep.get("bookings", {}).get("score", 0.0)))
    except Exception:
        hard_conflicts = 0
        soft_total = sched.get("soft_total", 0)
        b_score = 0.0

    alt_b = sum(1 for b in bookings if b.get("status") == "alternative_offered")
    rejected_b = sum(1 for b in bookings if b.get("status") == "rejected")
    booking_reqs = data.get("booking_requests", [])
    total_bookings = len(booking_reqs)
    max_b_score = float(total_bookings * 3.0) if total_bookings > 0 else 0.0

    rooms = data.get("rooms", [])
    rooms_count = len(rooms)
    total_slots = rooms_count * 5 * 8  # 8 teaching periods per day (excluding lunch P5) * 5 days
    used_slots = sum(s.get("duration", 1) for s in sched.get("sessions", []))
    room_util = round((used_slots / total_slots * 100), 1) if total_slots > 0 else 0.0

    # Calculate department load dynamically from sessions and active schedule
    c_dept = {c["id"]: c.get("department", "Other") for c in data.get("courses", [])}
    s_map = {sess["id"]: sess for sess in data.get("sessions", [])}
    dept_counts: Dict[str, Dict[str, Any]] = {}
    
    for entry in sched.get("sessions", []):
        sid = entry.get("session_id")
        sess = s_map.get(sid, {})
        cid = sess.get("course_id")
        dept = c_dept.get(cid, "Other")
        kind = sess.get("kind", "lecture")
        if dept not in dept_counts:
            dept_counts[dept] = {"name": dept, "lectures": 0, "labs": 0, "tutorials": 0}
        if kind == "lecture":
            dept_counts[dept]["lectures"] += 1
        elif kind == "lab":
            dept_counts[dept]["labs"] += 1
        elif kind == "tutorial":
            dept_counts[dept]["tutorials"] += 1

    major_order = ["CSE", "ECE", "ME", "CE", "EE"]
    sorted_dept_load = []
    for dname in major_order:
        if dname in dept_counts:
            sorted_dept_load.append(dept_counts[dname])
    for dname, dval in sorted(dept_counts.items()):
        if dname not in major_order:
            sorted_dept_load.append(dval)

    return DashboardMetrics(
        sessions_scheduled=sessions_count,
        total_sessions=total_sessions,
        hard_conflicts=hard_conflicts,
        soft_penalty_total=soft_total,
        pending_approvals=pending_b,
        approved_bookings=approved_b,
        booking_score=b_score,
        max_booking_score=max_b_score,
        room_utilization_rate=room_util,
        active_dataset_id=data.get("dataset_id", "cit-public-v1"),
        rooms_count=rooms_count,
        total_bookings=total_bookings,
        alternative_bookings=alt_b,
        rejected_bookings=rejected_b,
        department_load=sorted_dept_load
    )


@router.get("/metrics", response_model=DashboardMetrics)
def get_metrics_endpoint(db: Session = Depends(get_db)):
    """Public authenticated endpoint for live metrics."""
    return get_dashboard_metrics(db)


@router.get("/analytics/rooms")
def get_room_analytics(db: Session = Depends(get_db)):
    """Calculates weekly hours occupied and utilization percentage for each campus room."""
    data = get_active_dataset_dict(db)
    try:
        with open(get_export_schedule_path(), encoding="utf-8") as f:
            sched = json.load(f)
    except Exception:
        sched = {"sessions": []}

    rooms = data.get("rooms", [])
    sessions = sched.get("sessions", [])

    room_hours = {r["id"]: 0 for r in rooms}
    for s in sessions:
        rid = s.get("room_id")
        if rid in room_hours:
            room_hours[rid] += 1

    total_avail_hours = 5 * 9  # 45 teaching hours per week (P1-P9 Mon-Fri)

    res = []
    for r in rooms:
        h = room_hours.get(r["id"], 0)
        pct = round((h / total_avail_hours) * 100, 1)
        res.append({
            "room_id": r["id"],
            "name": r["name"],
            "building": r.get("building"),
            "type": r["type"],
            "capacity": r["capacity"],
            "hours_used": h,
            "total_hours": total_avail_hours,
            "utilization_pct": pct
        })

    res.sort(key=lambda x: x["utilization_pct"], reverse=True)
    return res


@router.get("/audit")
def get_audit_logs(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Returns chronologically ordered audit logs for all administrative actions (Admin only)."""
    logs = db.query(AuditLogModel).order_by(AuditLogModel.timestamp.desc()).limit(100).all()
    return logs


@router.get("/priority")
def get_priority_config(db: Session = Depends(get_db)):
    """Returns current booking priority ordering."""
    p_config = db.query(PriorityConfigModel).first()
    if p_config:
        return {"priority_order": p_config.priority_order}
    return {
        "priority_order": [
            "exam", "regular_session", "institute_event",
            "guest_lecture", "department_event", "club_event"
        ]
    }


@router.put("/priority")
def update_priority_config(
    body: PriorityUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Admin updates priority ordering with audit tracking."""
    p_config = db.query(PriorityConfigModel).first()
    before = p_config.priority_order if p_config else []
    if not p_config:
        p_config = PriorityConfigModel(id=1, priority_order=body.priority_order, updated_by=admin.email)
        db.add(p_config)
    else:
        p_config.priority_order = body.priority_order
        p_config.updated_by = admin.email
        p_config.updated_at = datetime.now(timezone.utc)

    db.add(AuditLogModel(
        actor=admin.email,
        action="UPDATE_PRIORITY_ORDER",
        entity="PriorityConfig",
        before_json={"order": before},
        after_json={"order": body.priority_order}
    ))
    db.commit()

    return {"status": "success", "priority_order": body.priority_order}


@router.post("/reset-demo")
def reset_demo(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Secure Idempotent Admin reset: restores database to a pristine demo state,
    seeds demo accounts, loads starter dataset, and resets active schedule.
    Strictly requires an authenticated Admin account (Requirement D).
    """
    try:
        # 1. Recreate tables
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

        # 2. Load starter dataset
        starter_path = get_starter_dataset_path()
        with open(starter_path, encoding="utf-8") as f:
            data = json.load(f)

        db.add(DatasetModel(
            dataset_id=data.get("dataset_id", "cit-public-v1"),
            raw_json=data,
            imported_by=admin.email,
            is_active=True
        ))

        # Seed priority config with official default ordering
        db.add(PriorityConfigModel(
            id=1,
            priority_order=data.get("priority_order", [
                "exam", "regular_session", "institute_event",
                "guest_lecture", "department_event", "club_event"
            ]),
            updated_by=admin.email
        ))

        # Seed initial audit log
        db.add(AuditLogModel(
            actor=admin.email,
            action="RESET_DEMO_STATE",
            entity="Database",
            after_json={"message": f"Demo state reset cleanly by admin {admin.email}"}
        ))

        db.commit()

        # 3. Seed all 62 official demo accounts dynamically from dataset
        from backend.app.core.seed_users import seed_users
        seeded_users = seed_users(db, data)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")

    return {
        "status": "success",
        "message": f"Demo environment reset successfully with clean starter data and {len(seeded_users)} demo accounts seeded.",
        "demo_accounts_count": len(seeded_users),
        "demo_accounts": [
            {"email": u.email, "role": u.role, "name": u.name}
            for u in seeded_users
        ]
    }
