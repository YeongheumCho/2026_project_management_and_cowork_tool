import json
from datetime import date, datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.security import hash_password, verify_password
from app.dependencies import get_current_user, get_db, require_admin
from app.models.project import PROJECT_TYPES, Project, SubProject, SubTask
from app.models.user import User
from app.models.workflow import (
    ProjectTemplate,
    UserSetting,
    WorkLog,
    WORKLOG_COMPLETED,
    WORKLOG_PAUSED,
    WORKLOG_RUNNING,
)
from app.schemas.workflow import (
    AssignmentRequest,
    AssignmentResponse,
    RecommendationCandidate,
    RecommendationRequest,
    RecommendationResponse,
    TemplateCreate,
    TemplateResponse,
    TemplateTaskItem,
    UserSettingsResponse,
    UserSettingsUpdate,
    WorkLogComplete,
    WorkLogResponse,
    WorkLogStart,
    WorkQueueItem,
)


router = APIRouter(tags=["workflow"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _deserialize_tasks(template: ProjectTemplate) -> list[dict]:
    return json.loads(template.tasks_json)


def _serialize_template_response(template: ProjectTemplate) -> TemplateResponse:
    return TemplateResponse(
        id=template.id,
        name=template.name,
        project_type=template.project_type,
        trigger_keyword=template.trigger_keyword,
        is_default=template.is_default,
        tasks=[TemplateTaskItem(**item) for item in _deserialize_tasks(template)],
        created_by=template.created_by,
        created_at=template.created_at,
    )


def _recommendation_reasons(
    user: User,
    availability_score: float,
    capability_score: float,
    remaining_minutes: int,
    keyword_hits: int,
) -> list[str]:
    free_minutes = max(0, 2400 - remaining_minutes)
    return [
        f"예상 가용 시간이 약 {free_minutes}분으로 계산되어 가용성 점수가 {availability_score:.0f}점입니다.",
        f"유사 업무 경험치 {keyword_hits}건이 반영되어 역량 점수가 {capability_score:.0f}점입니다.",
        f"{user.name}님의 현재 잔여 업무량은 약 {remaining_minutes}분입니다.",
    ]


@router.get("/work-queue/today", response_model=list[WorkQueueItem])
def get_today_work_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    subprojects = db.scalars(
        select(SubProject)
        .where(
            SubProject.assignee_id == current_user.id,
            SubProject.start_date <= today,
            SubProject.end_date >= today,
        )
        .order_by(SubProject.start_date.asc(), SubProject.id.asc())
    ).all()

    projects = (
        {
            project.id: project
            for project in db.scalars(
                select(Project).where(
                    Project.id.in_([subproject.project_id for subproject in subprojects])
                )
            ).all()
        }
        if subprojects
        else {}
    )

    return [
        WorkQueueItem(
            id=subproject.id,
            project_id=subproject.project_id,
            project_name=projects.get(subproject.project_id).name
            if projects.get(subproject.project_id)
            else "프로젝트",
            subproject_id=subproject.id,
            subproject_name=subproject.name,
            start_date=subproject.start_date,
            end_date=subproject.end_date,
            progress=float(subproject.progress),
            priority_hint="마감 임박" if subproject.end_date <= today else "오늘 진행",
        )
        for subproject in subprojects
    ]


@router.get("/work-logs", response_model=list[WorkLogResponse])
def list_work_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.scalars(
        select(WorkLog)
        .where(WorkLog.user_id == current_user.id)
        .order_by(WorkLog.created_at.desc(), WorkLog.id.desc())
    ).all()


@router.post("/work-logs/start", response_model=WorkLogResponse, status_code=status.HTTP_201_CREATED)
def start_work_log(
    payload: WorkLogStart,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = _utcnow()
    running_logs = db.scalars(
        select(WorkLog).where(
            WorkLog.user_id == current_user.id,
            WorkLog.status == WORKLOG_RUNNING,
        )
    ).all()

    for running_log in running_logs:
        if running_log.id in payload.continue_with_ids:
            continue
        if running_log.current_started_at:
            running_log.duration_sec += int(
                (now - running_log.current_started_at).total_seconds()
            )
        running_log.current_started_at = None
        running_log.status = WORKLOG_PAUSED

    resumable_log = db.scalar(
        select(WorkLog)
        .where(
            WorkLog.user_id == current_user.id,
            WorkLog.status == WORKLOG_PAUSED,
            WorkLog.subproject_id == payload.subproject_id,
            WorkLog.task_name == payload.task_name,
        )
        .order_by(WorkLog.created_at.desc(), WorkLog.id.desc())
    )
    if resumable_log:
        resumable_log.status = WORKLOG_RUNNING
        resumable_log.current_started_at = now
        db.commit()
        db.refresh(resumable_log)
        return resumable_log

    log = WorkLog(
        user_id=current_user.id,
        subproject_id=payload.subproject_id,
        task_name=payload.task_name,
        started_at=now,
        current_started_at=now,
        duration_sec=0,
        status=WORKLOG_RUNNING,
        session_group_id=uuid4().hex,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.post("/work-logs/{log_id}/pause", response_model=WorkLogResponse)
def pause_work_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.get(WorkLog, log_id)
    if not log or log.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="작업 기록을 찾을 수 없습니다.")
    if log.status != WORKLOG_RUNNING:
        return log

    now = _utcnow()
    if log.current_started_at:
        log.duration_sec += int((now - log.current_started_at).total_seconds())
    log.current_started_at = None
    log.status = WORKLOG_PAUSED
    db.commit()
    db.refresh(log)
    return log


@router.post("/work-logs/{log_id}/resume", response_model=WorkLogResponse)
def resume_work_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.get(WorkLog, log_id)
    if not log or log.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="작업 기록을 찾을 수 없습니다.")
    if log.status == WORKLOG_COMPLETED:
        raise HTTPException(status_code=400, detail="완료된 작업은 다시 시작할 수 없습니다.")

    log.status = WORKLOG_RUNNING
    log.current_started_at = _utcnow()
    db.commit()
    db.refresh(log)
    return log


@router.post("/work-logs/{log_id}/complete", response_model=WorkLogResponse)
def complete_work_log(
    log_id: int,
    payload: WorkLogComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.get(WorkLog, log_id)
    if not log or log.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="작업 기록을 찾을 수 없습니다.")

    now = _utcnow()
    if log.status == WORKLOG_RUNNING and log.current_started_at:
        log.duration_sec += int((now - log.current_started_at).total_seconds())
    log.current_started_at = None
    log.ended_at = now
    log.status = WORKLOG_COMPLETED

    for archive_id in payload.archived_ids:
        archived = db.get(WorkLog, archive_id)
        if not archived or archived.user_id != current_user.id:
            continue
        if archived.current_started_at:
            archived.duration_sec += int(
                (now - archived.current_started_at).total_seconds()
            )
        archived.current_started_at = None
        archived.ended_at = now
        archived.status = WORKLOG_COMPLETED

    db.commit()
    db.refresh(log)
    return log


@router.delete("/work-logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_work_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.get(WorkLog, log_id)
    if not log or log.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="작업 기록을 찾을 수 없습니다.")
    db.delete(log)
    db.commit()
    return None


@router.post("/ai/recommendations", response_model=RecommendationResponse)
def recommend_assignees(
    payload: RecommendationRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    users = db.scalars(
        select(User).where(User.is_active.is_(True)).order_by(User.name.asc())
    ).all()
    active_subprojects = db.scalars(
        select(SubProject).where(SubProject.status != "completed")
    ).all()
    all_projects = {project.id: project for project in db.scalars(select(Project)).all()}
    completed_logs = db.scalars(
        select(WorkLog).where(WorkLog.status == WORKLOG_COMPLETED)
    ).all()

    keyword = payload.project_name.strip().lower()
    candidates: list[RecommendationCandidate] = []

    for user in users:
        assigned_subprojects = [
            subproject
            for subproject in active_subprojects
            if subproject.assignee_id == user.id
        ]
        remaining_minutes = sum(
            subproject.total_minutes or subproject.avg_expected_minutes or 120
            for subproject in assigned_subprojects
        )
        availability_score = max(0.0, min(100.0, 100 - (remaining_minutes / 24)))

        same_type_count = sum(
            1
            for subproject in assigned_subprojects
            if all_projects.get(subproject.project_id)
            and all_projects[subproject.project_id].project_type == payload.project_type
        )
        keyword_hits = sum(
            1
            for log in completed_logs
            if log.user_id == user.id and keyword and keyword[:6] in log.task_name.lower()
        )
        capability_score = min(100.0, same_type_count * 18 + keyword_hits * 12 + 20)
        final_score = (
            payload.availability_weight * availability_score
            + payload.capability_weight * capability_score
        )

        candidates.append(
            RecommendationCandidate(
                user_id=user.id,
                name=user.name,
                role=user.role,
                rank=0,
                score=round(final_score, 2),
                availability_score=round(availability_score, 2),
                capability_score=round(capability_score, 2),
                remaining_minutes=remaining_minutes,
                keyword_experience_count=keyword_hits + same_type_count,
                reasons=_recommendation_reasons(
                    user=user,
                    availability_score=availability_score,
                    capability_score=capability_score,
                    remaining_minutes=remaining_minutes,
                    keyword_hits=keyword_hits + same_type_count,
                ),
            )
        )

    top_candidates = sorted(candidates, key=lambda item: item.score, reverse=True)[:3]
    for index, candidate in enumerate(top_candidates, start=1):
        candidate.rank = index

    return RecommendationResponse(request=payload, candidates=top_candidates)


@router.post("/ai/assignments", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
def assign_recommended_work(
    payload: AssignmentRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    assignee = db.get(User, payload.assignee_id)
    if not assignee:
        raise HTTPException(status_code=404, detail="담당자를 찾을 수 없습니다.")

    project = Project(
        name=payload.project_name,
        project_type=payload.project_type if payload.project_type in PROJECT_TYPES else "general",
        created_by=admin.id,
    )
    db.add(project)
    db.flush()

    subproject = SubProject(
        project_id=project.id,
        name=payload.subproject_name,
        assignee_id=assignee.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status="planned",
        progress=0,
    )
    db.add(subproject)
    db.flush()

    if payload.apply_template:
        template = db.scalar(
            select(ProjectTemplate).where(
                ProjectTemplate.project_type == project.project_type,
                ProjectTemplate.is_default.is_(True),
            )
        )
        if template:
            for index, item in enumerate(_deserialize_tasks(template), start=1):
                db.add(
                    SubTask(
                        subproject_id=subproject.id,
                        name=item["name"],
                        order_index=index,
                        weight=item["weight"],
                        is_done=False,
                    )
                )

    db.commit()
    db.refresh(subproject)
    return AssignmentResponse(
        project_id=project.id,
        subproject_id=subproject.id,
        assignee_id=assignee.id,
        assigned_member_name=assignee.name,
    )


@router.get("/settings/me", response_model=UserSettingsResponse)
def get_my_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings_row = db.scalar(select(UserSetting).where(UserSetting.user_id == current_user.id))
    if not settings_row:
        settings_row = UserSetting(user_id=current_user.id)
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)

    return UserSettingsResponse(
        id=current_user.id,
        idnum=current_user.idnum,
        name=current_user.name,
        role=current_user.role,
        default_calendar_view=settings_row.default_calendar_view,
        notifications_enabled=settings_row.notifications_enabled,
    )


@router.put("/settings/me", response_model=UserSettingsResponse)
def update_my_settings(
    payload: UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings_row = db.scalar(select(UserSetting).where(UserSetting.user_id == current_user.id))
    if not settings_row:
        settings_row = UserSetting(user_id=current_user.id)
        db.add(settings_row)
        db.flush()

    if payload.name is not None:
        current_user.name = payload.name
    if payload.new_password is not None:
        if not payload.current_password or not verify_password(
            payload.current_password, current_user.password_hash
        ):
            raise HTTPException(status_code=400, detail="현재 비밀번호가 올바르지 않습니다.")
        current_user.password_hash = hash_password(payload.new_password)
    if payload.default_calendar_view is not None:
        settings_row.default_calendar_view = payload.default_calendar_view
    if payload.notifications_enabled is not None:
        settings_row.notifications_enabled = payload.notifications_enabled

    db.commit()
    db.refresh(settings_row)

    return UserSettingsResponse(
        id=current_user.id,
        idnum=current_user.idnum,
        name=current_user.name,
        role=current_user.role,
        default_calendar_view=settings_row.default_calendar_view,
        notifications_enabled=settings_row.notifications_enabled,
    )


@router.get("/templates", response_model=list[TemplateResponse])
def list_templates(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    templates = db.scalars(
        select(ProjectTemplate).order_by(ProjectTemplate.created_at.desc())
    ).all()
    return [_serialize_template_response(template) for template in templates]


@router.post("/templates", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: TemplateCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    template = ProjectTemplate(
        name=payload.name,
        project_type=payload.project_type,
        trigger_keyword=payload.trigger_keyword,
        is_default=payload.is_default,
        tasks_json=json.dumps([item.model_dump() for item in payload.tasks]),
        created_by=admin.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return _serialize_template_response(template)


@router.put("/templates/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: int,
    payload: TemplateCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    template = db.get(ProjectTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="템플릿을 찾을 수 없습니다.")

    template.name = payload.name
    template.project_type = payload.project_type
    template.trigger_keyword = payload.trigger_keyword
    template.is_default = payload.is_default
    template.tasks_json = json.dumps([item.model_dump() for item in payload.tasks])
    db.commit()
    db.refresh(template)
    return _serialize_template_response(template)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    template = db.get(ProjectTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="템플릿을 찾을 수 없습니다.")
    db.delete(template)
    db.commit()
    return None
