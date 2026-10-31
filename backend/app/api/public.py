"""
Public endpoints: statistics and general platform metrics.
No authentication required.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.app.schemas.schemas import PublicStatsResponse
from backend.app.core.stats import get_real_stats

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/stats", response_model=PublicStatsResponse)
def get_public_stats(db: Session = Depends(get_db)):
    """
    Returns real, dynamically computed platform statistics read directly
    from the active dataset, schedule, and official validator report.
    """
    stats = get_real_stats(db=db)
    return PublicStatsResponse(
        sessions_scheduled=stats["sessions_scheduled"],
        hard_violations=stats["hard_violations"],
        booking_score=stats["booking_score"],
        bookings_count=stats["bookings_count"],
        last_reschedule_moved_count=stats["last_reschedule_moved_count"]
    )

