"""
Exports API endpoints: download or inspect schedule.json and schedule_after.json
with the official validator verification report attached.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json

from backend.app.database.session import get_db
from backend.app.core.config import (
    get_export_schedule_path, get_export_schedule_after_path,
    get_sample_disruption_path
)
from backend.app.core.dataset_loader import get_active_dataset_dict
from backend.validator.validator import run as official_validator_run, apply_disruption as official_apply_disruption

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/schedule")
def get_export_schedule(db: Session = Depends(get_db)):
    """Returns baseline exports/schedule.json with full validator report attached."""
    try:
        sched_path = get_export_schedule_path()
        with open(sched_path, encoding="utf-8") as f:
            sched = json.load(f)

        data = get_active_dataset_dict(db)
        val_report = official_validator_run(data, sched)
        return {
            "schedule": sched,
            "validator_report": val_report
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read exports/schedule.json: {str(e)}")


@router.get("/schedule-after")
def get_export_schedule_after(db: Session = Depends(get_db)):
    """Returns repaired exports/schedule_after.json with stability and validator report attached."""
    try:
        sched_after_path = get_export_schedule_after_path()
        sched_base_path = get_export_schedule_path()
        disruption_path = get_sample_disruption_path()

        with open(sched_after_path, encoding="utf-8") as f:
            sched_after = json.load(f)
        with open(sched_base_path, encoding="utf-8") as f:
            sched_base = json.load(f)

        data = get_active_dataset_dict(db)

        with open(disruption_path, encoding="utf-8") as f:
            disruption = json.load(f)

        disrupted_data = official_apply_disruption(data, disruption)
        val_report = official_validator_run(disrupted_data, sched_after, baseline=sched_base)

        return {
            "schedule_after": sched_after,
            "validator_report": val_report
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read exports/schedule_after.json: {str(e)}")
