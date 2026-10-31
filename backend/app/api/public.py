"""
Public endpoints: stats and health checks available without authentication.
"""
import os
import json
from pathlib import Path
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.app.models.entities import DatasetModel, ChangeProposalModel
from backend.app.schemas.schemas import PublicStatsResponse
from backend.validator.validator import run as official_validator_run

router = APIRouter(prefix="/public", tags=["public"])

_CACHE = {"mtime": 0, "report": None}


def _get_validator_report(data: dict, sched: dict, sched_path: str = "exports/schedule.json") -> dict:
    try:
        mtime = os.path.getmtime(sched_path)
    except Exception:
        mtime = 0
    if _CACHE["report"] is not None and _CACHE["mtime"] == mtime:
        return _CACHE["report"]
    report = official_validator_run(data, sched)
    _CACHE["mtime"] = mtime
    _CACHE["report"] = report
    return report


@router.get("/stats", response_model=PublicStatsResponse)
def get_public_stats(db: Session = Depends(get_db)):
    """
    Returns live metrics computed dynamically from active schedule and dataset.
    No hard-coded values.
    """
    # 1. Load active schedule
    sched_path = "exports/schedule.json"
    try:
        with open(sched_path, "r", encoding="utf-8") as f:
            sched = json.load(f)
    except Exception:
        sched = {"sessions": [], "fest_week": {"bookings": []}}

    # 2. Load dataset
    ds = db.query(DatasetModel).filter(DatasetModel.is_active == True).first()
    if ds:
        data = ds.raw_json
    else:
        try:
            with open("data/starter_dataset/cit_public.json", "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = {"sessions": [], "booking_requests": []}

    # 3. Validator report
    val_rep = _get_validator_report(data, sched, sched_path)

    sessions_count = len(sched.get("sessions", []))
    hard_violations = int(val_rep.get("hard_violation_count", len(val_rep.get("hard_violations", []))))
    
    val_b = val_rep.get("bookings", {})
    booking_score = float(val_b.get("booking_score", 0.0))

    # Total bookings count: approved + alternatives + rejected
    b_count = 0
    for k in ("approved", "alternatives", "rejected"):
        v = val_b.get(k)
        if isinstance(v, int):
            b_count += v
        elif isinstance(v, (list, tuple, dict)):
            b_count += len(v)

    if b_count == 0:
        b_count = len(sched.get("fest_week", {}).get("bookings", [])) or len(data.get("booking_requests", []))

    # 4. Last reschedule moved count
    moved_count = 0
    latest_prop = db.query(ChangeProposalModel).order_by(ChangeProposalModel.created_at.desc()).first()
    if latest_prop:
        moved_count = latest_prop.moved_count
    else:
        # Check exports/schedule_after.json diff against exports/schedule.json
        after_path = "exports/schedule_after.json"
        if os.path.exists(after_path) and os.path.exists(sched_path):
            try:
                with open(after_path, "r", encoding="utf-8") as fa:
                    sched_after = json.load(fa)
                base_map = {
                    s["session_id"]: (s["day"], s["start_period"], s["room_id"])
                    for s in sched.get("sessions", [])
                }
                diff = 0
                for s in sched_after.get("sessions", []):
                    sid = s.get("session_id")
                    if sid in base_map and base_map[sid] != (s["day"], s["start_period"], s["room_id"]):
                        diff += 1
                moved_count = diff
            except Exception:
                moved_count = 0

    return PublicStatsResponse(
        sessions_scheduled=sessions_count,
        hard_violations=hard_violations,
        booking_score=booking_score,
        bookings_count=b_count,
        last_reschedule_moved_count=moved_count
    )
