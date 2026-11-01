"""
Dataset management endpoints: import and active summary.
Authoritative source for the entire application (Issue E).
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import json

from backend.app.database.session import get_db
from backend.app.models.entities import (
    DatasetModel, RoomModel, FacultyModel, StudentGroupModel, CourseModel,
    SessionModel, BookingRequestModel, PriorityConfigModel, AuditLogModel, User
)
from backend.app.api.deps import require_admin
from backend.app.core.config import get_starter_dataset_path
from backend.app.core.dataset_loader import get_active_dataset_dict
from backend.app.rules.models import DatasetContext, effective_category

router = APIRouter(prefix="/dataset", tags=["dataset"])


@router.get("/active")
def get_active_dataset(db: Session = Depends(get_db)):
    """Returns metadata for the currently authoritative active dataset."""
    raw = get_active_dataset_dict(db)
    ds = db.query(DatasetModel).filter(DatasetModel.is_active == True).first()

    return {
        "dataset_id": raw.get("dataset_id", "cit-public-v1"),
        "imported_by": ds.imported_by if ds else "system",
        "imported_at": ds.imported_at.isoformat() if ds and ds.imported_at else None,
        "rooms_count": len(raw.get("rooms", [])),
        "faculty_count": len(raw.get("faculty", [])),
        "groups_count": len(raw.get("student_groups", [])),
        "courses_count": len(raw.get("courses", [])),
        "sessions_count": len(raw.get("sessions", [])),
        "booking_requests_count": len(raw.get("booking_requests", [])),
        "exams_count": len(raw.get("exams", [])),
        "is_active": True
    }


@router.post("/import")
def import_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Imports a new authoritative dataset JSON.
    Synchronizes rooms, faculty, groups, courses, sessions, requests, accounts, and priority.
    """
    try:
        content = file.file.read()
        data = json.loads(content.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {str(e)}")

    dataset_id = data.get("dataset_id", "uploaded-dataset")

    try:
        # Mark existing datasets inactive
        db.query(DatasetModel).update({"is_active": False})

        # Save or update active DatasetModel
        ds = db.query(DatasetModel).filter(DatasetModel.dataset_id == dataset_id).first()
        if not ds:
            ds = DatasetModel(
                dataset_id=dataset_id,
                raw_json=data,
                imported_by=admin.email,
                is_active=True
            )
            db.add(ds)
        else:
            ds.raw_json = data
            ds.imported_by = admin.email
            ds.is_active = True

        ctx = DatasetContext.from_dict(data)

        # 1. Sync rooms
        current_room_ids = set(ctx.rooms.keys())
        # Update or add
        for r in ctx.rooms.values():
            existing_r = db.query(RoomModel).filter(RoomModel.id == r.id).first()
            if not existing_r:
                db.add(RoomModel(
                    id=r.id, name=r.name, building=r.building, type=r.type,
                    capacity=r.capacity, features=r.features, accessible=r.accessible,
                    allowed_uses=r.allowed_uses
                ))
            else:
                existing_r.name = r.name
                existing_r.building = r.building
                existing_r.type = r.type
                existing_r.capacity = r.capacity
                existing_r.features = r.features
                existing_r.accessible = r.accessible
                existing_r.allowed_uses = r.allowed_uses
        # Delete removed
        db.query(RoomModel).filter(~RoomModel.id.in_(current_room_ids)).delete(synchronize_session=False)

        # 2. Sync faculty
        current_fac_ids = set(ctx.faculty.keys())
        for f in ctx.faculty.values():
            existing_f = db.query(FacultyModel).filter(FacultyModel.id == f.id).first()
            if not existing_f:
                db.add(FacultyModel(
                    id=f.id, name=f.name, department=f.department,
                    max_hours_per_day=f.max_hours_per_day,
                    needs_accessible=f.needs_accessible,
                    unavailable=f.unavailable, preferences=f.preferences
                ))
            else:
                existing_f.name = f.name
                existing_f.department = f.department
                existing_f.max_hours_per_day = f.max_hours_per_day
                existing_f.needs_accessible = f.needs_accessible
                existing_f.unavailable = f.unavailable
                existing_f.preferences = f.preferences
        db.query(FacultyModel).filter(~FacultyModel.id.in_(current_fac_ids)).delete(synchronize_session=False)

        # 3. Sync sessions
        current_sess_ids = set(ctx.sessions.keys())
        for s in ctx.sessions.values():
            existing_s = db.query(SessionModel).filter(SessionModel.id == s.id).first()
            if not existing_s:
                db.add(SessionModel(
                    id=s.id, course_id=s.course_id, kind=s.kind, groups=s.groups,
                    faculty_id=s.faculty_id, size=s.size, duration=s.duration,
                    room_types=s.room_types, needs_accessible=s.needs_accessible,
                    basket_slot=s.basket_slot, fixed_slot=s.fixed_slot
                ))
            else:
                existing_s.course_id = s.course_id
                existing_s.kind = s.kind
                existing_s.groups = s.groups
                existing_s.faculty_id = s.faculty_id
                existing_s.size = s.size
                existing_s.duration = s.duration
                existing_s.room_types = s.room_types
                existing_s.needs_accessible = s.needs_accessible
                existing_s.basket_slot = s.basket_slot
                existing_s.fixed_slot = s.fixed_slot
        db.query(SessionModel).filter(~SessionModel.id.in_(current_sess_ids)).delete(synchronize_session=False)

        # 4. Sync booking requests
        current_req_ids = set(ctx.booking_requests.keys())
        for b in ctx.booking_requests.values():
            eff_cat = effective_category(ctx, b)
            existing_b = db.query(BookingRequestModel).filter(BookingRequestModel.id == b.id).first()
            if not existing_b:
                db.add(BookingRequestModel(
                    id=b.id, submitted_at=b.submitted_at, requester=b.requester,
                    role=b.role, requested_category=b.requested_category,
                    effective_category=eff_cat, title=b.title, attendance=b.attendance,
                    duration_periods=b.duration_periods, windows=b.windows,
                    room_types=b.room_types, needs=b.needs, requested_room=b.requested_room,
                    mandatory_for_groups=b.mandatory_for_groups, series_id=b.series_id,
                    raw_text=b.raw_text, status="pending"
                ))
            else:
                existing_b.submitted_at = b.submitted_at
                existing_b.requester = b.requester
                existing_b.role = b.role
                existing_b.requested_category = b.requested_category
                existing_b.effective_category = eff_cat
                existing_b.title = b.title
                existing_b.attendance = b.attendance
                existing_b.duration_periods = b.duration_periods
                existing_b.windows = b.windows
                existing_b.room_types = b.room_types
                existing_b.needs = b.needs
                existing_b.requested_room = b.requested_room
                existing_b.mandatory_for_groups = b.mandatory_for_groups

        # 5. Sync priority config if present
        if "priority_order" in data:
            p_config = db.query(PriorityConfigModel).first()
            if p_config:
                p_config.priority_order = data["priority_order"]
                p_config.updated_by = admin.email
            else:
                db.add(PriorityConfigModel(id=1, priority_order=data["priority_order"], updated_by=admin.email))

        # 6. Seed/update user accounts dynamically from the newly imported dataset
        from backend.app.core.seed_users import seed_users
        seed_users(db, data)

        # 7. Audit log
        db.add(AuditLogModel(
            actor=admin.email,
            action="IMPORT_DATASET",
            entity=f"Dataset:{dataset_id}",
            after_json={"sessions_count": len(ctx.sessions), "rooms_count": len(ctx.rooms)}
        ))

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Dataset import failed: {str(e)}")

    return {
        "status": "success",
        "dataset_id": dataset_id,
        "message": f"Successfully imported dataset with {len(ctx.sessions)} sessions and {len(ctx.rooms)} rooms"
    }
