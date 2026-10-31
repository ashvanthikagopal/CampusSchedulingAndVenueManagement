"""
Exports API endpoints: download or inspect schedule.json and schedule_after.json
with the official validator verification report attached.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import json

from backend.validator.validator import run as official_validator_run, apply_disruption as official_apply_disruption

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/schedule")
def get_export_schedule():
    """Returns baseline exports/schedule.json with full validator report attached."""
    try:
        with open("exports/schedule.json", encoding="utf-8") as f:
            sched = json.load(f)
        with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
            data = json.load(f)

        val_report = official_validator_run(data, sched)
        return {
            "schedule": sched,
            "validator_report": val_report
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read exports/schedule.json: {str(e)}")


@router.get("/schedule-after")
def get_export_schedule_after():
    """Returns repaired exports/schedule_after.json with stability and validator report attached."""
    try:
        with open("exports/schedule_after.json", encoding="utf-8") as f:
            sched_after = json.load(f)
        with open("exports/schedule.json", encoding="utf-8") as f:
            sched_base = json.load(f)
        with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
            data = json.load(f)
        with open("starter_pack/examples/sample_disruption.json", encoding="utf-8") as f:
            disruption = json.load(f)

        disrupted_data = official_apply_disruption(data, disruption)
        val_report = official_validator_run(disrupted_data, sched_after, baseline=sched_base)

        return {
            "schedule_after": sched_after,
            "validator_report": val_report
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read exports/schedule_after.json: {str(e)}")

