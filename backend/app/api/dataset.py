"""
Dataset management endpoints: import and active summary.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import json

from backend.app.database.session import get_db
from backend.app.models.entities import (
    DatasetModel, RoomModel, FacultyModel, StudentGroupModel, CourseModel,
    SessionModel, BookingRequestModel, User
)
from backend.app.api.deps import require_admin, get_current_user
from backend.app.rules.models import DatasetContext, effective_category

router = APIRouter(prefix="/dataset", tags=["dataset"])


@router.get("/active")
def get_active_dataset(db: Session = Depends(get_db)):
    ds = db.query(DatasetModel).filter(DatasetModel.is_active == True).first()
    if not ds:
        # Load from disk starter dataset
        try:
            with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
                data = json.load(f)
            return {
                "dataset_id": data.get("dataset_id"),
                "rooms_count": len(data.get("rooms", [])),
                "faculty_count": len(data.get("faculty", [])),
                "groups_count": len(data.get("student_groups", [])),
                "courses_count": len(data.get("courses", [])),
                "sessions_count": len(data.get("sessions", [])),
                "booking_requests_count": len(data.get("booking_requests", [])),
                "exams_count": len(data.get("exams", [])),
                "is_active": True
            }
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"No active dataset found: {str(e)}")

    raw = ds.raw_json
    return {
        "dataset_id": ds.dataset_id,
        "imported_by": ds.imported_by,
        "imported_at": ds.imported_at,
        "rooms_count": len(raw.get("rooms", [])),
        "faculty_count": len(raw.get("faculty", [])),
        "groups_count": len(raw.get("student_groups", [])),
        "courses_count": len(raw.get("courses", [])),
        "sessions_count": len(raw.get("sessions", [])),
        "booking_requests_count": len(raw.get("booking_requests", [])),
        "exams_count": len(raw.get("exams", [])),
        "is_active": ds.is_active
    }


@router.post("/import")
def import_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    try:
        content = file.file.read()
        data = json.loads(content.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {str(e)}")

    dataset_id = data.get("dataset_id", "uploaded-dataset")

    # Mark existing datasets inactive
    db.query(DatasetModel).update({"is_active": False})

    # Save or update DatasetModel
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

    # Sync rooms, faculty, student groups, courses, sessions, requests
    ctx = DatasetContext.from_dict(data)

    # Sync rooms
    for r in ctx.rooms.values():
        existing_r = db.query(RoomModel).filter(RoomModel.id == r.id).first()
        if not existing_r:
            db.add(RoomModel(
                id=r.id, name=r.name, building=r.building, type=r.type,
                capacity=r.capacity, features=r.features, accessible=r.accessible,
                allowed_uses=r.allowed_uses
            ))

    # Sync faculty
    for f in ctx.faculty.values():
        existing_f = db.query(FacultyModel).filter(FacultyModel.id == f.id).first()
        if not existing_f:
            db.add(FacultyModel(
                id=f.id, name=f.name, department=f.department,
                max_hours_per_day=f.max_hours_per_day,
                needs_accessible=f.needs_accessible,
                unavailable=f.unavailable, preferences=f.preferences
            ))

    # Sync sessions
    for s in ctx.sessions.values():
        existing_s = db.query(SessionModel).filter(SessionModel.id == s.id).first()
        if not existing_s:
            db.add(SessionModel(
                id=s.id, course_id=s.course_id, kind=s.kind, groups=s.groups,
                faculty_id=s.faculty_id, size=s.size, duration=s.duration,
                room_types=s.room_types, needs_accessible=s.needs_accessible,
                basket_slot=s.basket_slot, fixed_slot=s.fixed_slot
            ))

    # Sync booking requests
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

    # Seed/update user accounts dynamically from the newly imported dataset
    from backend.app.core.seed_users import seed_users
    seed_users(db, data)

    db.commit()

    return {
        "status": "success",
        "dataset_id": dataset_id,
        "message": f"Successfully imported dataset with {len(ctx.sessions)} sessions and {len(ctx.rooms)} rooms"
    }

