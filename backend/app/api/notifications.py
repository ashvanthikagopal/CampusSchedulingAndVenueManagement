"""
Notifications API endpoints.
Provides in-app notification tracking for faculty and administrative events.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from backend.app.database.session import get_db
from backend.app.models.entities import NotificationModel, User
from backend.app.api.deps import get_current_user
from backend.app.schemas.schemas import NotificationListResponse, NotificationItem

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves unread and recent in-app notifications for the authenticated user."""
    notifs = db.query(NotificationModel).filter(
        NotificationModel.user_id == current_user.id
    ).order_by(NotificationModel.created_at.desc()).limit(30).all()

    unread_count = sum(1 for n in notifs if not n.is_read)

    items = [
        NotificationItem(
            id=n.id,
            user_id=n.user_id,
            title=n.title,
            message=n.message,
            type=n.type,
            link=n.link,
            is_read=n.is_read,
            created_at=n.created_at.isoformat() if n.created_at else None
        )
        for n in notifs
    ]

    return NotificationListResponse(unread_count=unread_count, items=items)


@router.post("/{notif_id}/read")
def mark_notification_read(
    notif_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Marks a single notification as read."""
    notif = db.query(NotificationModel).filter(
        NotificationModel.id == notif_id,
        NotificationModel.user_id == current_user.id
    ).first()

    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    db.commit()
    return {"status": "success", "id": notif_id}


@router.post("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Marks all notifications as read for the current user."""
    db.query(NotificationModel).filter(
        NotificationModel.user_id == current_user.id,
        NotificationModel.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"status": "success"}

