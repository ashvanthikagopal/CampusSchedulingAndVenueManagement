"""
SQLAlchemy ORM models mirroring the CIT dataset and system state.
Uses natural string keys for direct import/export fidelity.
"""
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Boolean, Text, JSON, DateTime, ForeignKey, Index, Float
)
from sqlalchemy.orm import relationship
from backend.app.database.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)  # admin, department_coordinator, faculty, club
    department = Column(String(50), nullable=True)
    faculty_id = Column(String(50), nullable=True)
    club_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DatasetModel(Base):
    __tablename__ = "datasets"

    dataset_id = Column(String(50), primary_key=True)
    raw_json = Column(JSON, nullable=False)
    imported_by = Column(String(50), nullable=True)
    imported_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class RoomModel(Base):
    __tablename__ = "rooms"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    building = Column(String(100), nullable=True)
    type = Column(String(50), nullable=False)
    capacity = Column(Integer, nullable=False)
    features = Column(JSON, default=list)
    accessible = Column(Boolean, default=False)
    allowed_uses = Column(JSON, default=list)


class FacultyModel(Base):
    __tablename__ = "faculty"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    department = Column(String(50), nullable=False)
    max_hours_per_day = Column(Integer, default=4)
    needs_accessible = Column(Boolean, default=False)
    unavailable = Column(JSON, default=list)
    preferences = Column(JSON, default=list)


class StudentGroupModel(Base):
    __tablename__ = "student_groups"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    year = Column(Integer, nullable=False)
    department = Column(String(50), nullable=False)
    size = Column(Integer, nullable=False)
    needs_accessible = Column(Boolean, default=False)


class CourseModel(Base):
    __tablename__ = "courses"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    lecture_hours = Column(Integer, default=0)
    tutorial_hours = Column(Integer, default=0)
    lab_blocks = Column(Integer, default=0)


class SessionModel(Base):
    __tablename__ = "sessions"

    id = Column(String(50), primary_key=True)
    course_id = Column(String(50), nullable=False)
    kind = Column(String(20), nullable=False)
    groups = Column(JSON, default=list)
    faculty_id = Column(String(50), nullable=False)
    size = Column(Integer, nullable=False)
    duration = Column(Integer, nullable=False)
    room_types = Column(JSON, default=list)
    needs_accessible = Column(Boolean, default=False)
    basket_slot = Column(String(50), nullable=True)
    fixed_slot = Column(JSON, nullable=True)


class ScheduleVersion(Base):
    __tablename__ = "schedule_versions"

    id = Column(String(50), primary_key=True)
    kind = Column(String(50), default="base")  # base | after_change
    status = Column(String(50), default="active")  # draft | pending_approval | active | rejected
    solver_status = Column(String(50), default="OPTIMAL")
    solver_seconds = Column(Float, default=0.0)
    soft_penalty = Column(Integer, default=0)
    validator_report = Column(JSON, default=dict)
    created_by = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    entries = relationship("ScheduleEntry", back_populates="version", cascade="all, delete-orphan")
    overrides = relationship("SessionOverride", back_populates="version", cascade="all, delete-orphan")
    exams = relationship("ExamAssignment", back_populates="version", cascade="all, delete-orphan")


class ScheduleEntry(Base):
    __tablename__ = "schedule_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(String(50), ForeignKey("schedule_versions.id"), nullable=False, index=True)
    session_id = Column(String(50), nullable=False, index=True)
    day = Column(String(10), nullable=False)
    start_period = Column(Integer, nullable=False)
    room_id = Column(String(50), nullable=False)

    version = relationship("ScheduleVersion", back_populates="entries")

    __table_args__ = (
        Index("idx_sched_ver_sess", "version_id", "session_id", unique=True),
        Index("idx_sched_room_day", "room_id", "day"),
    )


class SessionOverride(Base):
    __tablename__ = "session_overrides"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(String(50), ForeignKey("schedule_versions.id"), nullable=False, index=True)
    session_id = Column(String(50), nullable=False)
    day = Column(String(10), nullable=False)
    start_period = Column(Integer, nullable=False)
    room_id = Column(String(50), nullable=False)
    displaced_by = Column(String(50), nullable=False)

    version = relationship("ScheduleVersion", back_populates="overrides")


class BookingRequestModel(Base):
    __tablename__ = "booking_requests"

    id = Column(String(50), primary_key=True)
    submitted_at = Column(String(50), nullable=False)
    requester = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False)
    requested_category = Column(String(50), nullable=False)
    effective_category = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    attendance = Column(Integer, nullable=False)
    duration_periods = Column(Integer, nullable=False)
    windows = Column(JSON, default=list)
    room_types = Column(JSON, default=list)
    needs = Column(JSON, default=list)
    requested_room = Column(String(50), nullable=True)
    mandatory_for_groups = Column(JSON, default=list)
    series_id = Column(String(50), nullable=True)
    raw_text = Column(Text, nullable=True)
    status = Column(String(50), default="pending")  # approved, rejected, alternative_offered, cancelled, pending
    submitted_by = Column(String(50), nullable=True)

    __table_args__ = (
        Index("idx_booking_status", "status"),
    )


class BookingDecisionModel(Base):
    __tablename__ = "booking_decisions"

    request_id = Column(String(50), primary_key=True)
    status = Column(String(50), nullable=False)  # approved, rejected, alternative_offered
    day = Column(String(10), nullable=True)
    start_period = Column(Integer, nullable=True)
    end_period = Column(Integer, nullable=True)
    room_id = Column(String(50), nullable=True)
    reason_code = Column(String(50), nullable=False)
    reason_text = Column(Text, nullable=False)
    rule_trace = Column(JSON, default=dict)
    decided_by = Column(String(50), nullable=True)
    decided_at = Column(DateTime, default=datetime.utcnow)


class ExamAssignment(Base):
    __tablename__ = "exam_assignments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(String(50), ForeignKey("schedule_versions.id"), nullable=False, index=True)
    exam_id = Column(String(50), nullable=False)
    day = Column(String(10), nullable=False)
    session = Column(String(10), nullable=False)  # AM or PM
    rooms = Column(JSON, default=list)

    version = relationship("ScheduleVersion", back_populates="exams")


class DisruptionModel(Base):
    __tablename__ = "disruptions"

    id = Column(String(50), primary_key=True)
    payload = Column(JSON, nullable=False)
    reported_by = Column(String(50), nullable=True)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)


class ChangeProposalModel(Base):
    __tablename__ = "change_proposals"

    id = Column(String(50), primary_key=True)
    disruption_id = Column(String(50), nullable=True)
    base_version_id = Column(String(50), nullable=False)
    new_version_id = Column(String(50), nullable=True)
    moved_count = Column(Integer, default=0)
    hard_violations = Column(Integer, default=0)
    soft_delta = Column(Integer, default=0)
    status = Column(String(50), default="pending_approval")  # pending_approval, approved, rejected
    entries_json = Column(JSON, default=list)
    repaired_schedule_json = Column(JSON, nullable=True)
    validator_report = Column(JSON, default=dict)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class NotificationModel(Base):
    __tablename__ = "notifications"

    id = Column(String(50), primary_key=True)
    user_id = Column(String(50), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="info")  # proposal_approved, booking_decided, disruption_status
    link = Column(String(200), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class SessionRequestModel(Base):
    __tablename__ = "session_requests"

    id = Column(String(50), primary_key=True)
    faculty_id = Column(String(50), nullable=False, index=True)
    course_id = Column(String(50), nullable=False)
    kind = Column(String(50), default="lecture")  # lecture, tutorial, lab
    duration = Column(Integer, default=1)
    groups = Column(JSON, default=list)
    preferred_windows = Column(JSON, default=list)
    reason = Column(Text, nullable=True)
    request_type = Column(String(50), default="move")  # move, extra
    target_session_id = Column(String(50), nullable=True)
    status = Column(String(50), default="pending")  # pending, approved, rejected
    submitted_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class PriorityConfigModel(Base):
    __tablename__ = "priority_config"

    id = Column(Integer, primary_key=True, default=1)
    priority_order = Column(JSON, nullable=False)
    updated_by = Column(String(50), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)


class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    actor = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)
    entity = Column(String(100), nullable=False)
    before_json = Column(JSON, nullable=True)
    after_json = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

