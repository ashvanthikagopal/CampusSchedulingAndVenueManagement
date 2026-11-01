"""
Midsem Exam Scheduling API endpoints.
Provides exam schedules with half-capacity seat arithmetic display.
"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json

from backend.app.database.session import get_db
from backend.app.models.entities import User, AuditLogModel
from backend.app.api.deps import require_admin, get_current_user
from backend.app.core.config import get_export_schedule_path
from backend.app.core.dataset_loader import get_active_dataset_dict
from backend.app.schemas.schemas import ExamAssignmentItem
from backend.app.rules.models import DatasetContext
from backend.app.solver.exam_solver import solve_exams

router = APIRouter(prefix="/exams", tags=["exams"])


@router.get("/schedule", response_model=List[ExamAssignmentItem])
def get_exam_schedule(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns all 41 midsem exams with detailed half-capacity room seat arithmetic."""
    if current_user.role == "club":
        raise HTTPException(status_code=403, detail="Exams schedule is restricted to academic members and administration")
    data = get_active_dataset_dict(db)
    sched_path = get_export_schedule_path()

    try:
        with open(sched_path, encoding="utf-8") as f:
            sched = json.load(f)
    except Exception:
        sched = {"exams": []}

    exam_meta = {e["id"]: e for e in data.get("exams", [])}
    room_meta = {r["id"]: r for r in data.get("rooms", [])}

    res: List[ExamAssignmentItem] = []
    for ex in sched.get("exams", []):
        eid = ex["exam_id"]
        e_info = exam_meta.get(eid, {})
        assigned_rooms = ex.get("rooms", [])

        room_details = []
        total_effective = 0
        for rid in assigned_rooms:
            r = room_meta.get(rid, {})
            full_cap = r.get("capacity", 0)
            halved_cap = full_cap // 2
            total_effective += halved_cap
            room_details.append({
                "room_id": rid,
                "room_name": r.get("name"),
                "full_capacity": full_cap,
                "halved_capacity": halved_cap
            })

        res.append(ExamAssignmentItem(
            exam_id=eid,
            course_ids=e_info.get("course_ids", []),
            groups=e_info.get("groups", []),
            size=e_info.get("size", 0),
            day=ex.get("day"),
            session=ex.get("session"),
            rooms=assigned_rooms,
            room_details=room_details,
            total_effective_seats=total_effective
        ))

    return res


@router.post("/generate")
def generate_exams_endpoint(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Re-runs the CP-SAT exam scheduler."""
    data = get_active_dataset_dict(db)
    sched_path = get_export_schedule_path()

    try:
        with open(sched_path, encoding="utf-8") as f:
            sched = json.load(f)
    except Exception:
        sched = {"exams": []}

    ctx = DatasetContext.from_dict(data)
    status_e, exam_assigns, stats = solve_exams(ctx, time_limit_seconds=30.0)

    sched["exams"] = exam_assigns
    with open(sched_path, "w", encoding="utf-8") as f:
        json.dump(sched, f, indent=2)

    db.add(AuditLogModel(
        actor=admin.email,
        action="GENERATE_EXAMS",
        entity="ExamsSchedule",
        after_json=stats
    ))
    db.commit()

    return {
        "status": status_e,
        "total_scheduled": len(exam_assigns or []),
        "stats": stats
    }
