"""
Timetable scheduling endpoints: generate, jobs, view, validate, explain, and move.
"""
import uuid
import threading
import json
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session

from backend.app.database.session import get_db, SessionLocal
from backend.app.models.entities import (
    ScheduleVersion, ScheduleEntry, SessionOverride, SessionModel, RoomModel,
    FacultyModel, StudentGroupModel, DatasetModel, AuditLogModel, User
)
from backend.app.api.deps import require_admin, get_current_user, get_current_user_optional, get_optional_user
from backend.app.schemas.schemas import (
    ScheduleViewResponse, ScheduleSessionItem, ScheduleJobResponse,
    SessionExplainResponse, ManualMoveRequest, ManualMoveResponse,
    FacultyScheduleResponse, FacultyDailyWorkload
)
from backend.app.rules.models import DatasetContext
from backend.app.rules.timetable import validate_full_timetable, compute_soft_penalties, block
from backend.app.rules.engine import evaluate_schedule
from backend.app.solver.timetable_solver import solve_timetable
from backend.app.solver.booking_engine import solve_bookings
from backend.app.solver.exam_solver import solve_exams
from backend.validator.validator import run as official_validator_run

router = APIRouter(prefix="/schedule", tags=["schedule"])

# In-memory background jobs registry
JOBS: Dict[str, Dict[str, Any]] = {}


def run_solver_background_job(job_id: str, admin_email: str):
    db = SessionLocal()
    JOBS[job_id]["status"] = "RUNNING"
    try:
        # Load dataset
        ds = db.query(DatasetModel).filter(DatasetModel.is_active == True).first()
        if ds:
            data = ds.raw_json
        else:
            with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
                data = json.load(f)

        ctx = DatasetContext.from_dict(data)

        # 1. Solve timetable
        status_t, timetable_assign, stats_t = solve_timetable(ctx, time_limit_seconds=45.0, num_workers=8)
        if not timetable_assign:
            JOBS[job_id]["status"] = "FAILED"
            JOBS[job_id]["error"] = f"Solver returned status: {status_t}"
            return

        # 2. Solve exams
        status_e, exam_assigns, stats_e = solve_exams(ctx, time_limit_seconds=20.0, num_workers=8)

        # 3. Solve bookings
        booking_decisions, session_overrides, stats_b = solve_bookings(ctx, timetable_assign, time_limit_seconds=20.0)

        # Build schedule JSON
        sessions_list = [
            {"session_id": sid, "day": d, "start_period": st, "room_id": r}
            for sid, (d, st, r) in sorted(timetable_assign.items())
        ]
        sched_dict = {
            "team": "CIT Scheduler Master Team",
            "dataset_id": ctx.dataset_id,
            "sessions": sessions_list,
            "fest_week": {
                "bookings": booking_decisions,
                "session_overrides": session_overrides
            },
            "exams": exam_assigns or []
        }

        # Evaluate with validator
        val_rep = official_validator_run(data, sched_dict)

        # Save to database
        version_id = f"v_base_{uuid.uuid4().hex[:8]}"
        # Set previous active versions to draft
        db.query(ScheduleVersion).filter(ScheduleVersion.status == "active").update({"status": "draft"})

        new_version = ScheduleVersion(
            id=version_id,
            kind="base",
            status="active",
            solver_status=status_t,
            solver_seconds=stats_t.get("solve_seconds", 0.0),
            soft_penalty=val_rep.get("soft_total", 0),
            validator_report=val_rep,
            created_by=admin_email
        )
        db.add(new_version)

        # Add entries
        for sid, (d, st, r) in timetable_assign.items():
            db.add(ScheduleEntry(
                version_id=version_id,
                session_id=sid,
                day=d,
                start_period=st,
                room_id=r
            ))

        # Add overrides
        for ov in session_overrides:
            db.add(SessionOverride(
                version_id=version_id,
                session_id=ov["session_id"],
                day=ov["day"],
                start_period=ov["start_period"],
                room_id=ov["room_id"],
                displaced_by=ov["displaced_by"]
            ))

        # Also update disk export exports/schedule.json
        try:
            with open("exports/schedule.json", "w", encoding="utf-8") as f:
                json.dump(sched_dict, f, indent=2)
        except Exception:
            pass

        # Write audit log
        db.add(AuditLogModel(
            actor=admin_email,
            action="GENERATE_TIMETABLE",
            entity=f"ScheduleVersion:{version_id}",
            after_json={"hard_violations": val_rep.get("hard_violation_count", 0), "soft_total": val_rep.get("soft_total", 0)}
        ))

        db.commit()

        JOBS[job_id]["status"] = "COMPLETED"
        JOBS[job_id]["result"] = {
            "version_id": version_id,
            "hard_violations": val_rep.get("hard_violation_count", 0),
            "soft_total": val_rep.get("soft_total", 0),
            "sessions_count": len(sessions_list),
            "solve_seconds": stats_t.get("solve_seconds", 0.0),
            "booking_score": val_rep.get("bookings", {}).get("booking_score", 0.0)
        }
    except Exception as e:
        JOBS[job_id]["status"] = "FAILED"
        JOBS[job_id]["error"] = str(e)
    finally:
        db.close()


@router.post("/generate", response_model=ScheduleJobResponse)
def generate_schedule(
    background_tasks: BackgroundTasks,
    admin: User = Depends(require_admin)
):
    job_id = f"job_{uuid.uuid4().hex[:10]}"
    JOBS[job_id] = {
        "job_id": job_id,
        "status": "PENDING",
        "result": None,
        "error": None
    }
    background_tasks.add_task(run_solver_background_job, job_id, admin.email)
    return {
        "job_id": job_id,
        "status": "PENDING"
    }


@router.get("/jobs/{job_id}", response_model=ScheduleJobResponse)
def get_job_status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/groups")
def get_schedule_groups(db: Session = Depends(get_db)):
    """
    Returns student groups categorized by year and department,
    along with directory lists for faculty and venues to power frontend dropdown selectors.
    """
    ds = db.query(DatasetModel).filter(DatasetModel.is_active == True).first()
    if ds:
        data = ds.raw_json
    else:
        with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
            data = json.load(f)

    raw_groups = data.get("student_groups", [])
    groups = []
    for g in raw_groups:
        gid = g["id"]
        if gid.startswith("Y1"):
            year = 1
            dept = "First Year"
        else:
            parts = gid.split("-")
            dept = parts[0]
            year = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 2
        groups.append({
            "id": gid,
            "name": g.get("name", gid),
            "size": g.get("size", 0),
            "year": year,
            "department": dept
        })

    by_year = {
        "Year 1 (First Year)": [g for g in groups if g["year"] == 1],
        "Year 2 (Core Engineering)": [g for g in groups if g["year"] == 2],
        "Year 3 (Core & Open Electives)": [g for g in groups if g["year"] == 3],
    }

    by_dept = {}
    for g in groups:
        d = g["department"]
        by_dept.setdefault(d, []).append(g)

    faculty = [
        {"id": f["id"], "name": f["name"], "department": f.get("department", "")}
        for f in data.get("faculty", [])
    ]

    rooms = [
        {"id": r["id"], "name": r["name"], "building": r.get("building", ""), "type": r.get("type", "")}
        for r in data.get("rooms", [])
    ]

    return {
        "groups": groups,
        "by_year": by_year,
        "by_dept": by_dept,
        "faculty": faculty,
        "rooms": rooms
    }


@router.get("", response_model=ScheduleViewResponse)
def get_schedule(
    view: Optional[str] = Query(None, description="group, faculty, or room"),
    id: Optional[str] = Query(None, description="filter id"),
    week: Optional[int] = Query(1, description="Week number (e.g. 7 for Spectra Week)"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    # For role=club, restrict viewing detailed faculty/group timetables
    if current_user and current_user.role == "club" and view in ("faculty", "group"):
        raise HTTPException(
            status_code=403,
            detail=f"{view.capitalize()} timetable view is not accessible to club representatives"
        )

    # For role=student, restrict viewing to their own group
    if current_user and current_user.role == "student" and current_user.student_group:
        if view == "group" and id and id != current_user.student_group:
            raise HTTPException(status_code=403, detail="Students can only view their own class timetable")
        if not view:
            view = "group"
        if not id:
            id = current_user.student_group

    # For role=faculty, restrict faculty view to their own faculty_id
    if current_user and current_user.role == "faculty" and view == "faculty":
        if id and id != current_user.faculty_id:
            raise HTTPException(status_code=403, detail="Faculty can only view their own faculty timetable")
        if not id:
            id = current_user.faculty_id

    # Get active version
    ver = db.query(ScheduleVersion).filter(ScheduleVersion.status == "active").order_by(ScheduleVersion.created_at.desc()).first()

    # If no database version yet, check exports/schedule.json
    sessions_data = []
    overrides_data = []
    soft_total = 0
    soft_pens = {}
    val_rep = {}
    ver_id = "initial_v1"

    if ver:
        ver_id = ver.id
        soft_total = ver.soft_penalty
        val_rep = ver.validator_report or {}
        soft_pens = val_rep.get("soft_penalties", {})

        entries = db.query(ScheduleEntry).filter(ScheduleEntry.version_id == ver.id).all()
        for e in entries:
            sessions_data.append({
                "session_id": e.session_id,
                "day": e.day,
                "start_period": e.start_period,
                "room_id": e.room_id
            })

        overrides = db.query(SessionOverride).filter(SessionOverride.version_id == ver.id).all()
        for o in overrides:
            overrides_data.append({
                "session_id": o.session_id,
                "day": o.day,
                "start_period": o.start_period,
                "room_id": o.room_id,
                "displaced_by": o.displaced_by
            })
    else:
        # Load from disk
        try:
            with open("exports/schedule.json", encoding="utf-8") as f:
                disk_sched = json.load(f)
            sessions_data = disk_sched.get("sessions", [])
            fest = disk_sched.get("fest_week", {})
            overrides_data = fest.get("session_overrides", [])
        except Exception:
            pass

    # Load metadata (sessions, rooms, faculty)
    ds = db.query(DatasetModel).filter(DatasetModel.is_active == True).first()
    if ds:
        data = ds.raw_json
    else:
        with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
            data = json.load(f)

    session_meta = {s["id"]: s for s in data.get("sessions", [])}
    room_meta = {r["id"]: r for r in data.get("rooms", [])}
    fac_meta = {f["id"]: f for f in data.get("faculty", [])}

    # If week == 7, apply session overrides
    effective_assign = {}
    for s in sessions_data:
        effective_assign[s["session_id"]] = (s["day"], s["start_period"], s["room_id"], None)

    if week == 7:
        for ov in overrides_data:
            effective_assign[ov["session_id"]] = (ov["day"], ov["start_period"], ov["room_id"], ov["displaced_by"])

    # Build response items
    items: List[ScheduleSessionItem] = []
    for sid, (d, st, rid, disp_by) in effective_assign.items():
        s_obj = session_meta.get(sid, {})
        r_obj = room_meta.get(rid, {})
        f_obj = fac_meta.get(s_obj.get("faculty_id"), {})

        # Apply filtering
        if view == "group" and id:
            if id not in s_obj.get("groups", []):
                continue
        elif view == "faculty" and id:
            if s_obj.get("faculty_id") != id:
                continue
        elif view == "room" and id:
            if rid != id:
                continue

        dur = s_obj.get("duration", 1)
        items.append(ScheduleSessionItem(
            session_id=sid,
            course_id=s_obj.get("course_id"),
            kind=s_obj.get("kind"),
            groups=s_obj.get("groups", []),
            faculty_id=s_obj.get("faculty_id"),
            faculty_name=f_obj.get("name"),
            size=s_obj.get("size"),
            duration=dur,
            day=d,
            start_period=st,
            end_period=st + dur - 1,
            room_id=rid,
            room_name=r_obj.get("name"),
            basket_slot=s_obj.get("basket_slot"),
            displaced_by=disp_by
        ))

    # If week == 7 and view is room or null, overlay approved event bookings!
    if week == 7:
        fest_bookings = []
        try:
            with open("exports/schedule.json", encoding="utf-8") as f:
                disk_sched = json.load(f)
            fest_bookings = disk_sched.get("fest_week", {}).get("bookings", [])
        except Exception:
            pass

        for b in fest_bookings:
            if b.get("status") == "approved":
                b_room = b.get("room_id")
                if view == "room" and id and b_room != id:
                    continue
                r_obj = room_meta.get(b_room, {})
                items.append(ScheduleSessionItem(
                    session_id=b.get("request_id"),
                    course_id=b.get("title", "Event"),
                    kind="event",
                    groups=[],
                    faculty_id=None,
                    faculty_name=b.get("requester"),
                    size=None,
                    duration=b.get("end_period", 1) - b.get("start_period", 1) + 1,
                    day=b.get("day"),
                    start_period=b.get("start_period"),
                    end_period=b.get("end_period"),
                    room_id=b_room,
                    room_name=r_obj.get("name"),
                    is_event=True
                ))

    return ScheduleViewResponse(
        dataset_id=data.get("dataset_id", "cit-public-v1"),
        version_id=ver_id,
        kind="base" if week != 7 else "week_7",
        status="active",
        sessions=items,
        overrides=overrides_data,
        soft_total=soft_total,
        soft_penalties=soft_pens,
        hard_violations=val_rep.get("hard_violations", [])
    )


@router.get("/faculty/my-schedule", response_model=FacultyScheduleResponse)
def get_faculty_my_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    faculty_id: Optional[str] = Query(None, description="Faculty ID override for admins")
):
    """
    Returns the weekly schedule grid and daily workload metrics for the logged-in faculty member.
    Enforces that faculty can only view their own schedule.
    """
    target_fid = current_user.faculty_id
    if current_user.role == "admin" and faculty_id:
        target_fid = faculty_id

    if not target_fid:
        raise HTTPException(status_code=400, detail="No faculty ID associated with this account")

    # Load dataset metadata
    with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
        data = json.load(f)
    with open("exports/schedule.json", encoding="utf-8") as f:
        sched = json.load(f)

    ctx = DatasetContext.from_dict(data)
    fac_obj = ctx.faculty.get(target_fid)
    if not fac_obj:
        raise HTTPException(status_code=404, detail=f"Faculty {target_fid} not found in campus directory")

    max_hrs = fac_obj.max_hours_per_day
    sess_meta = {s["id"]: s for s in data.get("sessions", [])}
    room_meta = {r["id"]: r for r in data.get("rooms", [])}

    # Extract all sessions for this faculty
    my_sessions = []
    day_hours = {d: 0 for d in ["MON", "TUE", "WED", "THU", "FRI"]}
    occupied_periods = {d: set() for d in ["MON", "TUE", "WED", "THU", "FRI"]}

    for item in sched.get("sessions", []):
        sid = item["session_id"]
        s_obj = sess_meta.get(sid, {})
        if s_obj.get("faculty_id") == target_fid:
            d = item["day"]
            st = item["start_period"]
            dur = s_obj.get("duration", 1)
            rid = item["room_id"]
            r_obj = room_meta.get(rid, {})

            if d in day_hours:
                day_hours[d] += dur
                for p in block(st, dur):
                    occupied_periods[d].add(p)

            my_sessions.append(ScheduleSessionItem(
                session_id=sid,
                course_id=s_obj.get("course_id"),
                kind=s_obj.get("kind"),
                groups=s_obj.get("groups", []),
                faculty_id=target_fid,
                faculty_name=fac_obj.name,
                size=s_obj.get("size"),
                duration=dur,
                day=d,
                start_period=st,
                end_period=st + dur - 1,
                room_id=rid,
                room_name=r_obj.get("name"),
                basket_slot=s_obj.get("basket_slot"),
                is_event=False
            ))

    # Compute daily workload and free periods (P1 to P9, excluding P5 lunch)
    daily_workload = []
    total_weekly_hours = 0
    for d in ["MON", "TUE", "WED", "THU", "FRI"]:
        th = day_hours[d]
        total_weekly_hours += th
        free_p = [p for p in range(1, 10) if p != 5 and p not in occupied_periods[d]]
        daily_workload.append(FacultyDailyWorkload(
            day=d,
            teaching_hours=th,
            max_hours=max_hrs,
            free_periods=free_p
        ))

    return FacultyScheduleResponse(
        faculty_id=target_fid,
        faculty_name=fac_obj.name,
        department=fac_obj.department,
        max_hours_per_day=max_hrs,
        total_weekly_hours=total_weekly_hours,
        daily_workload=daily_workload,
        sessions=my_sessions
    )


@router.post("/validate")
def validate_schedule_endpoint(schedule_data: Optional[Dict[str, Any]] = None, db: Session = Depends(get_db)):
    """Runs official validator.py and returns the exact verification report."""
    ds = db.query(DatasetModel).filter(DatasetModel.is_active == True).first()
    if ds:
        data = ds.raw_json
    else:
        with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
            data = json.load(f)

    if not schedule_data:
        with open("exports/schedule.json", encoding="utf-8") as f:
            schedule_data = json.load(f)

    rep = official_validator_run(data, schedule_data)
    return rep


@router.get("/sessions/{sid}/explain", response_model=SessionExplainResponse)
def explain_session(sid: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Deterministic explanation: real legal options count, blockers, why here, penalty deltas."""
    from backend.app.rules.faculty_checks import enumerate_legal_options, explain_infeasible

    with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
        data = json.load(f)
    with open("exports/schedule.json", encoding="utf-8") as f:
        sched = json.load(f)

    ctx = DatasetContext.from_dict(data)
    s = ctx.sessions.get(sid)
    if not s:
        raise HTTPException(status_code=404, detail=f"Session {sid} not found")

    # If role is faculty, ensure session belongs to this faculty member
    if current_user.role == "faculty" and s.faculty_id != current_user.faculty_id:
        raise HTTPException(status_code=403, detail="NOT_OWN_SESSION: Faculty can only access explanations for their own sessions")

    # Find current assignment
    current_assign = None
    base_assign = {}
    for entry in sched.get("sessions", []):
        base_assign[entry["session_id"]] = (entry["day"], entry["start_period"], entry["room_id"])
        if entry["session_id"] == sid:
            current_assign = (entry["day"], entry["start_period"], entry["room_id"])

    if not current_assign:
        raise HTTPException(status_code=404, detail=f"Session {sid} is not scheduled")

    cur_d, cur_st, cur_r = current_assign

    # Fetch approved bookings from DB
    bookings_list = []
    try:
        from backend.app.models.entities import BookingRequestModel, BookingDecisionModel
        b_reqs = db.query(BookingRequestModel).all()
        b_decs = {d.request_id: d for d in db.query(BookingDecisionModel).all()}
        for req in b_reqs:
            dec = b_decs.get(req.id)
            status_val = req.status or (dec.status if dec else "pending")
            if dec and dec.status:
                status_val = dec.status
            if status_val == "approved" and dec:
                bookings_list.append({
                    "id": req.id,
                    "title": req.title,
                    "status": "approved",
                    "assigned_day": dec.day,
                    "start_period": dec.start_period,
                    "end_period": dec.end_period,
                    "assigned_room": dec.room_id,
                    "mandatory_for_groups": req.mandatory_for_groups or []
                })
    except Exception:
        bookings_list = []

    # Deterministically calculate real legal options using unified faculty_checks
    all_legal = enumerate_legal_options(
        ctx=ctx,
        current_assign=base_assign,
        session_id=sid,
        bookings=bookings_list,
        limit=50,
        actor=current_user
    )

    real_legal_count = len(all_legal)
    distinct_alts = [
        opt for opt in all_legal
        if not (opt["day"] == cur_d and opt["start_period"] == cur_st and opt["room_id"] == cur_r)
    ]

    infeasible_diag = None
    if real_legal_count == 0 or len(distinct_alts) == 0:
        infeasible_diag = explain_infeasible(
            ctx=ctx,
            current_assign=base_assign,
            session_id=sid,
            bookings=bookings_list,
            actor=current_user
        )

    alt_slots = []
    for a in distinct_alts[:3]:
        alt_slots.append({
            "day": a["day"],
            "start_period": a["start_period"],
            "end_period": a["end_period"],
            "room_id": a["room_id"],
            "room_name": a["room_name"],
            "soft_delta": a["soft_penalty_delta"],
            "soft_breakdown": a["soft_breakdown"],
            "checked_rules": a["checked_rules"],
            "reason": f"Conflict-free slot in {a['room_name']} ({a['day']} Period {a['start_period']}, Δ soft: {a['soft_penalty_delta']:+d})"
        })

    r_curr = ctx.rooms.get(cur_r)
    reasons = [
        f"Assigned to {cur_r} ({r_curr.name if r_curr else cur_r}) with capacity {r_curr.capacity if r_curr else '?'} for class size {s.size}.",
        f"Type '{r_curr.type if r_curr else '?'}' matches required room types: {', '.join(s.room_types)}."
    ]
    if s.needs_accessible:
        reasons.append(f"Room {cur_r} satisfies wheelchair accessibility requirement.")
    if s.basket_slot:
        reasons.append(f"Synchronized with elective basket '{s.basket_slot}' across Year 3 tracks.")

    fac_obj = ctx.faculty.get(s.faculty_id)
    conflicts_avoided = [
        f"Avoided faculty {s.faculty_id} unavailability and daily overload (under {fac_obj.max_hours_per_day if fac_obj else 4}h/day limit).",
        f"Avoided student group clashes across: {', '.join(s.groups)}.",
        f"Protected lunch break interval after Period 5."
    ]

    explanation_text = (
        f"Session {sid} ({s.course_id}) is positioned at {cur_d} Period {cur_st} in {cur_r}. "
        f"This satisfies faculty unavailability constraints for {fac_obj.name if fac_obj else s.faculty_id}, respects group scheduling spans for {', '.join(s.groups)}, "
        f"and minimizes campus-wide soft penalty points."
    )

    checked_rules_list = [
        "H1_Once", "H2_FacultyClash", "H3_GroupClash", "H4_RoomClash",
        "H5_Capacity", "H6_RoomType", "H7_FacultyUnavail", "H8_RoomUnavail",
        "H9_Lunch_LabStart", "H10_Accessibility", "H11_BasketSync",
        "H12_DailyLimit", "H14_FixedSlot", "ApprovedBookings"
    ]

    return SessionExplainResponse(
        session_id=sid,
        assigned_day=cur_d,
        assigned_period=cur_st,
        assigned_room=cur_r,
        legal_options_count=real_legal_count,
        reasons_for_placement=reasons,
        conflicts_avoided=conflicts_avoided,
        alternative_slots=alt_slots,
        explanation_text=explanation_text,
        infeasible_explanation=infeasible_diag,
        checked_rules=checked_rules_list
    )


@router.post("/move", response_model=ManualMoveResponse)
def move_session(move: ManualMoveRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Manual placement dialog: validates proposed move against deterministic rules.
    Admin can move any session; Dept Coordinator can move own department's sessions.
    Faculty cannot directly move sessions (must submit request).
    """
    from backend.app.rules.faculty_checks import check_candidate_move, enumerate_legal_options

    if current_user.role not in ("admin", "department_coordinator"):
        raise HTTPException(status_code=403, detail="NOT_AUTHORIZED: Only Admin and Department Coordinators can move sessions directly")

    with open("data/starter_dataset/cit_public.json", encoding="utf-8") as f:
        data = json.load(f)
    with open("exports/schedule.json", encoding="utf-8") as f:
        sched = json.load(f)

    ctx = DatasetContext.from_dict(data)
    s = ctx.sessions.get(move.session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    # If department coordinator, check session belongs to their department
    if current_user.role == "department_coordinator":
        grp_depts = [ctx.student_groups[g].department for g in s.groups if g in ctx.student_groups]
        if current_user.department not in grp_depts:
            raise HTTPException(status_code=403, detail="Coordinators can only move sessions within their department")

    base_assign = {
        item["session_id"]: (item["day"], item["start_period"], item["room_id"])
        for item in sched.get("sessions", [])
    }
    if move.session_id not in base_assign:
        raise HTTPException(status_code=404, detail="Session not present in active schedule")

    # Fetch approved bookings from DB
    bookings_list = []
    try:
        from backend.app.models.entities import BookingRequestModel, BookingDecisionModel
        b_reqs = db.query(BookingRequestModel).all()
        b_decs = {d.request_id: d for d in db.query(BookingDecisionModel).all()}
        for req in b_reqs:
            dec = b_decs.get(req.id)
            status_val = req.status or (dec.status if dec else "pending")
            if dec and dec.status:
                status_val = dec.status
            if status_val == "approved" and dec:
                bookings_list.append({
                    "id": req.id,
                    "title": req.title,
                    "status": "approved",
                    "assigned_day": dec.day,
                    "start_period": dec.start_period,
                    "end_period": dec.end_period,
                    "assigned_room": dec.room_id,
                    "mandatory_for_groups": req.mandatory_for_groups or []
                })
    except Exception:
        bookings_list = []

    # Comprehensive deterministic candidate move check
    check_result = check_candidate_move(
        ctx=ctx,
        current_assign=base_assign,
        session_id=move.session_id,
        day=move.target_day,
        start=move.target_start_period,
        room_id=move.target_room_id,
        bookings=bookings_list,
        actor=current_user
    )

    if not check_result["ok"]:
        suggested = enumerate_legal_options(
            ctx=ctx,
            current_assign=base_assign,
            session_id=move.session_id,
            bookings=bookings_list,
            limit=3,
            actor=current_user
        )
        return ManualMoveResponse(
            valid=False,
            violations=check_result["hard_violations"],
            suggested_alternatives=[
                {
                    "day": opt["day"],
                    "start_period": opt["start_period"],
                    "room_id": opt["room_id"],
                    "room_name": opt["room_name"],
                    "soft_delta": opt["soft_penalty_delta"]
                }
                for opt in suggested
            ],
            message=f"Move blocked by {len(check_result['hard_violations'])} rule violation(s). Hard constraints cannot be bypassed.",
            soft_breakdown=check_result["soft_breakdown"],
            soft_penalty_delta=check_result["soft_penalty_delta"]
        )

    # Valid! Update exports/schedule.json and DB
    sched_copy = json.loads(json.dumps(sched))
    for item in sched_copy["sessions"]:
        if item["session_id"] == move.session_id:
            item["day"] = move.target_day
            item["start_period"] = move.target_start_period
            item["room_id"] = move.target_room_id
            break

    with open("exports/schedule.json", "w", encoding="utf-8") as f:
        json.dump(sched_copy, f, indent=2)

    db.add(AuditLogModel(
        actor=current_user.email,
        action="MANUAL_SESSION_MOVE",
        entity=f"Session:{move.session_id}",
        after_json={"day": move.target_day, "start_period": move.target_start_period, "room_id": move.target_room_id}
    ))
    db.commit()

    return ManualMoveResponse(
        valid=True,
        violations=[],
        suggested_alternatives=[],
        message="Session successfully moved. Validated with 0 hard violations.",
        soft_breakdown=check_result["soft_breakdown"],
        soft_penalty_delta=check_result["soft_penalty_delta"]
    )
