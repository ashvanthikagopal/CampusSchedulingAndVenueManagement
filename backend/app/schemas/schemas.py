"""
Pydantic schemas for request/response serialization and validation.
Frontend and backend contracts are kept strictly aligned.
"""
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


# --- Auth Schemas ---
class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    department: Optional[str] = None
    faculty_id: Optional[str] = None
    club_name: Optional[str] = None
    student_group: Optional[str] = None


# --- Timetable Schemas ---
class ScheduleSessionItem(BaseModel):
    session_id: str
    course_id: Optional[str] = None
    kind: Optional[str] = None
    groups: List[str] = []
    faculty_id: Optional[str] = None
    faculty_name: Optional[str] = None
    size: Optional[int] = None
    duration: Optional[int] = 1
    day: str
    start_period: int
    end_period: Optional[int] = None
    room_id: str
    room_name: Optional[str] = None
    basket_slot: Optional[str] = None
    is_event: bool = False
    displaced_by: Optional[str] = None


class ScheduleViewResponse(BaseModel):
    dataset_id: str
    version_id: str
    kind: str
    status: str
    sessions: List[ScheduleSessionItem]
    overrides: List[Dict[str, Any]] = []
    soft_total: int = 0
    soft_penalties: Dict[str, int] = {}
    hard_violations: List[Dict[str, Any]] = []


class ScheduleJobResponse(BaseModel):
    job_id: str
    status: str  # PENDING, RUNNING, COMPLETED, FAILED
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class SessionExplainResponse(BaseModel):
    session_id: str
    assigned_day: str
    assigned_period: int
    assigned_room: str
    legal_options_count: int
    reasons_for_placement: List[str]
    conflicts_avoided: List[str]
    alternative_slots: List[Dict[str, Any]]
    explanation_text: str
    infeasible_explanation: Optional[Dict[str, Any]] = None
    checked_rules: List[str] = []


class ManualMoveRequest(BaseModel):
    session_id: str
    target_day: str
    target_start_period: int
    target_room_id: str


class ManualMoveResponse(BaseModel):
    valid: bool
    violations: List[Dict[str, Any]] = []
    suggested_alternatives: List[Dict[str, Any]] = []
    message: str
    soft_breakdown: Optional[Dict[str, int]] = None
    soft_penalty_delta: Optional[int] = None


# --- Booking Schemas ---
class BookingWindow(BaseModel):
    day: str
    from_period: int
    to_period: int


class BookingCreateRequest(BaseModel):
    title: str
    attendance: int
    duration_periods: int
    windows: List[BookingWindow]
    room_types: List[str]
    needs: List[str] = []
    requested_room: Optional[str] = None
    mandatory_for_groups: List[str] = []
    requested_category: Optional[str] = "club_event"
    raw_text: Optional[str] = None


class BookingParseRequest(BaseModel):
    text: str


class BookingParseResponse(BaseModel):
    intent: str
    title: str
    attendance: int
    duration_periods: int
    windows: List[BookingWindow]
    room_types: List[str]
    needs: List[str]
    requested_room: Optional[str] = None
    mandatory_for_groups: List[str] = []
    assumptions: List[str] = []
    follow_up_question: Optional[str] = None
    effective_category: str
    raw_text: str
    parsed_by: str  # "gemini" or "rule_fallback"


class BookingCheckRequest(BaseModel):
    booking: BookingCreateRequest


class BookingCheckResponse(BaseModel):
    pass_validation: bool
    reason_code: str
    reason: str
    suggested_alternative: Optional[Dict[str, Any]] = None


class BookingDecisionRequest(BaseModel):
    action: str  # "approve", "reject", "alternative_offered"
    reason: Optional[str] = None
    day: Optional[str] = None
    start_period: Optional[int] = None
    end_period: Optional[int] = None
    room_id: Optional[str] = None


# --- Exam Schemas ---
class ExamAssignmentItem(BaseModel):
    exam_id: str
    course_ids: List[str] = []
    groups: List[str] = []
    size: int
    day: str
    session: str  # "AM" or "PM"
    rooms: List[str]
    room_details: List[Dict[str, Any]] = []
    total_effective_seats: int


# --- Disruption & Proposal Schemas ---
class DisruptionCreateRequest(BaseModel):
    description: Optional[str] = None
    changes: List[Dict[str, Any]]


class ChangeProposalResponse(BaseModel):
    proposal_id: str
    base_version_id: str
    moved_count: int
    time_changed_count: int
    room_only_changed_count: int
    hard_violations: int
    soft_delta: int
    status: str
    moved_sessions: List[Dict[str, Any]]
    validator_report: Dict[str, Any]


# --- AI Chat & Explanation Schemas ---
class AIChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None


class AIChatResponse(BaseModel):
    reply: str
    proposal_card: Optional[Dict[str, Any]] = None
    suggested_actions: List[str] = []
    is_fallback: bool = False


class AIExplainRequest(BaseModel):
    session_id: str


# --- Admin & Dashboard Schemas ---
class DashboardMetrics(BaseModel):
    sessions_scheduled: int
    total_sessions: int
    hard_conflicts: int
    soft_penalty_total: int
    pending_approvals: int
    approved_bookings: int
    booking_score: float
    max_booking_score: float
    room_utilization_rate: float
    active_dataset_id: str


class PriorityUpdateRequest(BaseModel):
    priority_order: List[str]


# --- Notifications Schemas ---
class NotificationItem(BaseModel):
    id: str
    user_id: str
    title: str
    message: str
    type: str = "info"
    link: Optional[str] = None
    is_read: bool = False
    created_at: Optional[str] = None


class NotificationListResponse(BaseModel):
    unread_count: int
    items: List[NotificationItem]


# --- Session Request Schemas ---
class SessionRequestCreate(BaseModel):
    course_id: str
    kind: str = "lecture"
    duration: int = 1
    groups: List[str] = []
    preferred_windows: List[Dict[str, Any]] = []
    reason: Optional[str] = None
    request_type: str = "move"  # move or extra
    target_session_id: Optional[str] = None


class SessionRequestItem(BaseModel):
    id: str
    faculty_id: str
    course_id: str
    kind: str
    duration: int
    groups: List[str] = []
    preferred_windows: List[Dict[str, Any]] = []
    reason: Optional[str] = None
    request_type: str
    target_session_id: Optional[str] = None
    status: str
    submitted_by: str
    created_at: Optional[str] = None


# --- Faculty Schedule Schemas ---
class FacultyDailyWorkload(BaseModel):
    day: str
    teaching_hours: int
    max_hours: int
    free_periods: List[int] = []


class FacultyScheduleResponse(BaseModel):
    faculty_id: str
    faculty_name: str
    department: str
    max_hours_per_day: int
    total_weekly_hours: int
    daily_workload: List[FacultyDailyWorkload]
    sessions: List[ScheduleSessionItem]


# --- Infeasible Diagnostic Schema ---
class InfeasibleDiagnosticResponse(BaseModel):
    status: str = "INFEASIBLE"
    violated_rules: List[str] = []
    affected_sessions: List[str] = []
    conflicting_resources: List[str] = []
    explanation: str
    suggestions: List[str] = []

