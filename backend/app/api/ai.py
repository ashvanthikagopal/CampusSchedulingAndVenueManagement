"""
AI Chat & Explainer API endpoints.
Provides faculty assistant conversational interface with proposal cards and validation badges.
All decisions and metrics are strictly produced by deterministic engines.
"""
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
import json

from backend.app.schemas.schemas import AIChatRequest, AIChatResponse
from backend.app.api.deps import get_current_user
from backend.app.models.entities import User
from backend.app.rules.models import DatasetContext
import backend.app.ai.schedule_tools as T

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/chat", response_model=AIChatResponse)
def ai_chat(req: AIChatRequest, current_user: User = Depends(get_current_user)):
    """
    Conversational assistant for faculty and admins.
    Delegates all proposals and rule evaluations to schedule_tools.
    """
    with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
        data = json.load(f)
    with open("exports/schedule.json", encoding="utf-8") as f:
        sched = json.load(f)

    ctx = DatasetContext.from_dict(data)
    fid = current_user.faculty_id if current_user.role == "faculty" else None
    result = T.assistant_reply(ctx, T.to_assign(sched), fid, current_user.name, req.message)
    return AIChatResponse(**result)

