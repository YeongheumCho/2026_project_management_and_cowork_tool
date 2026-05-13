"""
프로젝트/소프로젝트/세부 태스크 REST API.

엔드포인트 요약
  # Projects
  POST   /projects                     관리자: 최상위 프로젝트 생성
  GET    /projects                     전체 사용자: 프로젝트 목록
  # SubProjects
  POST   /subprojects                  관리자: 소프로젝트 생성 (프로젝트 유형에 따라 세부 태스크 자동 생성)
  GET    /subprojects                  쿼리: ?project_id, ?assignee_id
  GET    /subprojects/{id}             단건 조회
  PUT    /subprojects/{id}             관리자: KEFICO 필드 포함 부분 수정
  DELETE /subprojects/{id}             관리자: 미완료 상태에서만 삭제
  # SubTasks
  PATCH  /subtasks/{id}                체크/해제 — 담당자 본인 또는 관리자
"""
import json
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.dependencies import get_current_user, get_db, require_admin
from app.models.project import (
    DEFAULT_SUBTASK_TEMPLATE,
    ETC_SUBTASK_TEMPLATE,
    INSPECTION_SUBTASK_TEMPLATE,
    STATUS_COMPLETED,
    STATUS_IN_PROGRESS,
    STATUS_PLANNED,
    Project,
    SubProject,
    SubTask,
    project_participants,
    subproject_assignees,
)
from app.models.progress_log import ProgressLog
from app.models.user import User
from app.models.workflow import WORKLOG_RUNNING, ProjectExecutionHistory, WorkLog
from app.schemas.progress_log import ProgressLogCreate, ProgressLogResponse
from app.schemas.project import (
    ProjectHistoryCreate,
    ProjectHistoryEntry,
    ProjectHistoryMemberSummary,
    ProjectHistorySummary,
    ProjectHistoryUpdate,
    ProjectMemberTimeSummary,
    ProjectCreate,
    ProjectResponse,
    ProjectTimeSummary,
    ProjectUpdate,
    SubProjectCreate,
    SubProjectResponse,
    SubProjectUpdate,
    SubTaskResponse,
    SubTaskUpdate,
)


router = APIRouter(tags=["projects"])


# 프로젝트 유형 → 세부 태스크 템플릿 매핑
_TEMPLATE_BY_TYPE = {
    "official_inspection": INSPECTION_SUBTASK_TEMPLATE,
    "regular_inspection": INSPECTION_SUBTASK_TEMPLATE,
    "change_inspection": INSPECTION_SUBTASK_TEMPLATE,
    "etc_task": ETC_SUBTASK_TEMPLATE,
    "general": DEFAULT_SUBTASK_TEMPLATE,
}


# 업데이트 시 공통으로 복사할 KEFICO 필드 목록
_KEFICO_COPY_FIELDS = (
    "priority", "controller_name", "controller_version", "controller_country",
    "to_number", "to_assignee", "verification_level", "vehicle_type",
    "function_name", "function_owner", "verifier_id", "reviewer_id",
    "seat_no", "controller_no", "avg_expected_minutes", "issue_note",
    "upload_done", "special_note", "completed_on",
    "first_verify_status", "first_setup_min", "first_aud_min", "first_review_min",
    "inreview_status", "inreview_setup_min", "inreview_aud_min", "inreview_feedback_min",
    "cr_no", "ip_addr", "change_feedback_min", "change_revalidate_min", "lin_std_hold_note",
    "etc_category", "etc_month", "etc_days", "etc_note",
)


# ========== helpers ==========

def _recalc_status_and_progress(sp: SubProject) -> None:
    total_weight = sum(float(t.weight) for t in sp.subtasks) or 1.0
    done_weight = sum(float(t.weight) for t in sp.subtasks if t.is_done)
    sp.progress = round(done_weight / total_weight * 100, 2)

    if sp.progress >= 100:
        sp.status = STATUS_COMPLETED
    elif done_weight > 0:
        sp.status = STATUS_IN_PROGRESS
    else:
        sp.status = STATUS_PLANNED


def _load_subproject(db: Session, subproject_id: int) -> SubProject:
    sp = db.scalar(
        select(SubProject)
        .options(
            selectinload(SubProject.subtasks),
            selectinload(SubProject.assignee),
            selectinload(SubProject.assignees),
            selectinload(SubProject.verifier),
            selectinload(SubProject.reviewer),
        )
        .where(SubProject.id == subproject_id)
    )
    if not sp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="소프로젝트를 찾을 수 없습니다.",
        )
    return sp


def _subproject_assignee_ids(sp: SubProject) -> set[int]:
    ids = {user.id for user in (sp.assignees or [])}
    if sp.assignee_id is not None:
        ids.add(sp.assignee_id)
    return ids


def _payload_assignee_ids(payload) -> list[int] | None:
    if "assignee_ids" in payload.model_fields_set:
        return list(dict.fromkeys(payload.assignee_ids or []))
    if "assignee_id" in payload.model_fields_set and payload.assignee_id is not None:
        return [payload.assignee_id]
    return None


def _load_valid_assignees(
    db: Session,
    project: Project | None,
    assignee_ids: list[int],
) -> list[User]:
    if not assignee_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="담당자를 1명 이상 선택해주세요.",
        )

    assignees = db.scalars(
        select(User)
        .where(User.id.in_(assignee_ids), User.is_active.is_(True))
        .order_by(User.name.asc())
    ).all()
    if len(assignees) != len(assignee_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 담당자가 포함되어 있습니다.",
        )

    if project and project.participants:
        participant_ids = {member.id for member in project.participants}
        invalid = [user.name for user in assignees if user.id not in participant_ids]
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="담당자는 해당 프로젝트 참여 인원 중에서만 선택할 수 있습니다.",
            )

    order = {user_id: index for index, user_id in enumerate(assignee_ids)}
    return sorted(assignees, key=lambda user: order[user.id])


def _set_subproject_assignees(sp: SubProject, assignees: list[User]) -> None:
    sp.assignees = assignees
    sp.assignee_id = assignees[0].id if assignees else None


def _get_visible_project_ids_for_user(db: Session, current_user: User) -> set[int]:
    if current_user.role == "admin":
        return set(
            db.scalars(select(Project.id)).all()
        )

    # Use whole-project membership as the primary visibility rule. Keep assigned
    # subprojects as a fallback for older data that may not have participants.
    participant_project_ids = set(
        db.scalars(
            select(project_participants.c.project_id).where(
                project_participants.c.user_id == current_user.id
            )
        ).all()
    )
    assigned_project_ids = set(
        db.scalars(
            select(SubProject.project_id)
            .where(SubProject.assignee_id == current_user.id)
            .distinct()
        ).all()
    )
    assigned_project_ids |= set(
        db.scalars(
            select(SubProject.project_id)
            .join(
                subproject_assignees,
                subproject_assignees.c.subproject_id == SubProject.id,
            )
            .where(subproject_assignees.c.user_id == current_user.id)
            .distinct()
        ).all()
    )
    return participant_project_ids | assigned_project_ids


def _ensure_subproject_access(sp: SubProject, current_user: User) -> None:
    if current_user.role == "admin":
        return
    if current_user.id not in _subproject_assignee_ids(sp):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="해당 소프로젝트에 접근할 수 없습니다.",
        )


def _estimate_worked_minutes(db: Session, subproject_id: int, assignee_id: int | None) -> int:
    if assignee_id is None:
        return 0

    now = datetime.now(timezone.utc)
    logs = db.scalars(
        select(WorkLog).where(
            WorkLog.subproject_id == subproject_id,
            WorkLog.user_id == assignee_id,
        )
    ).all()

    total_seconds = 0
    for log in logs:
        total_seconds += log.duration_sec
        if log.status == WORKLOG_RUNNING and log.current_started_at:
            total_seconds += max(0, int((now - log.current_started_at).total_seconds()))
    return max(0, total_seconds // 60)


def _build_history_keywords(project: Project, subproject: SubProject) -> str:
    tokens = [
        project.name,
        subproject.name,
        subproject.function_name,
        subproject.controller_name,
        subproject.vehicle_type,
        subproject.verification_level,
        subproject.priority,
        subproject.cr_no,
        subproject.etc_category,
    ]
    return " ".join(token.strip() for token in tokens if token and token.strip())


def _sync_subproject_execution_history(
    db: Session,
    project: Project,
    subproject: SubProject,
) -> None:
    existing_rows = db.scalars(
        select(ProjectExecutionHistory).where(
            ProjectExecutionHistory.subproject_id == subproject.id
        )
    ).all()

    # 관리자가 수동 편집한 행은 자동 동기화 대상에서 제외 — 보존만 한다.
    auto_rows = [row for row in existing_rows if not row.manual_override]

    assignee_ids = sorted(_subproject_assignee_ids(subproject))
    if subproject.status != STATUS_COMPLETED or not assignee_ids:
        for row in auto_rows:
            db.delete(row)
        return

    fallback_minutes = (
        subproject.total_minutes
        or subproject.avg_expected_minutes
        or max(1, (subproject.end_date - subproject.start_date).days + 1) * 60
    )
    auto_by_user = {row.user_id: row for row in auto_rows}
    for row in auto_rows:
        if row.user_id not in assignee_ids:
            db.delete(row)

    for assignee_id in assignee_ids:
        history = auto_by_user.get(assignee_id)
        if history is None:
            history = ProjectExecutionHistory(
                user_id=assignee_id,
                project_id=project.id,
                subproject_id=subproject.id,
            )
            db.add(history)

        worked_minutes = _estimate_worked_minutes(db, subproject.id, assignee_id)
        if worked_minutes <= 0:
            worked_minutes = fallback_minutes

        history.project_name = project.name
        history.subproject_name = subproject.name
        history.project_type = project.project_type
        history.role_in_project = "assignee"
        history.started_on = subproject.start_date
        history.ended_on = subproject.completed_on or subproject.end_date
        history.worked_minutes = worked_minutes
        history.completion_rate = float(subproject.progress)
        history.keyword_text = _build_history_keywords(project, subproject)


def _serialize_history_entry(history: ProjectExecutionHistory, user: User | None) -> ProjectHistoryEntry:
    return ProjectHistoryEntry(
        id=history.id,
        user_id=history.user_id,
        user_name=user.name if user else "",
        project_id=history.project_id,
        project_name=history.project_name,
        subproject_id=history.subproject_id,
        subproject_name=history.subproject_name,
        project_type=history.project_type,
        role_in_project=history.role_in_project,
        started_on=history.started_on,
        ended_on=history.ended_on,
        worked_minutes=history.worked_minutes,
        completion_rate=float(history.completion_rate),
        recorded_at=history.recorded_at,
        manual_override=bool(history.manual_override),
    )


def _apply_kefico_fields(sp: SubProject, payload) -> None:
    """payload에서 KEFICO 필드들 중 값이 들어온 것만 sp에 반영."""
    data = payload.model_dump(exclude_unset=True)
    for fname in _KEFICO_COPY_FIELDS:
        if fname in data:
            setattr(sp, fname, data[fname])
    # 커스텀 필드 반영
    if "custom_fields" in data and data["custom_fields"] is not None:
        sp.custom_fields = json.dumps(data["custom_fields"], ensure_ascii=False)
    elif "custom_fields" in data and data["custom_fields"] is None:
        sp.custom_fields = None


def _subproject_weight_minutes(subproject: SubProject) -> int:
    return max(
        1,
        subproject.total_minutes
        or subproject.avg_expected_minutes
        or max(1, (subproject.end_date - subproject.start_date).days + 1) * 60,
    )


def _serialize_project_response(project: Project) -> ProjectResponse:
    subprojects = list(project.subprojects or [])
    total_weight = sum(_subproject_weight_minutes(subproject) for subproject in subprojects)
    weighted_progress = (
        sum(float(subproject.progress) * _subproject_weight_minutes(subproject) for subproject in subprojects)
        / total_weight
        if total_weight > 0
        else 0.0
    )
    completed_count = sum(1 for subproject in subprojects if subproject.status == STATUS_COMPLETED)
    in_progress_count = sum(1 for subproject in subprojects if subproject.status == STATUS_IN_PROGRESS)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        project_type=project.project_type,
        start_date=project.start_date,
        end_date=project.end_date,
        created_by=project.created_by,
        created_at=project.created_at,
        participants=list(project.participants or []),
        progress_percent=round(weighted_progress, 2),
        subproject_count=len(subprojects),
        completed_subproject_count=completed_count,
        in_progress_subproject_count=in_progress_count,
    )


# ========== Projects ==========

@router.post(
    "/projects",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    participant_ids = list(dict.fromkeys(payload.participant_ids))
    participants = db.scalars(
        select(User)
        .where(User.id.in_(participant_ids), User.is_active.is_(True))
        .order_by(User.name.asc())
    ).all()
    if len(participants) != len(participant_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 프로젝트 참여 인원이 포함되어 있습니다.",
        )

    project = Project(
        name=payload.name,
        project_type=payload.project_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        created_by=admin.id,
    )
    project.participants = participants
    db.add(project)
    db.commit()
    project = db.scalar(
        select(Project)
        .options(
            selectinload(Project.participants),
            selectinload(Project.subprojects).selectinload(SubProject.assignees),
        )
        .where(Project.id == project.id)
    )
    return _serialize_project_response(project)


@router.get("/projects", response_model=list[ProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Project)
        .options(selectinload(Project.participants), selectinload(Project.subprojects))
        .order_by(Project.created_at.desc())
    )
    if current_user.role != "admin":
        visible_project_ids = _get_visible_project_ids_for_user(db, current_user)
        if not visible_project_ids:
            return []
        stmt = stmt.where(Project.id.in_(visible_project_ids))
    return [_serialize_project_response(project) for project in db.scalars(stmt).all()]


@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    project = db.scalar(
        select(Project)
        .options(
            selectinload(Project.participants),
            selectinload(Project.subprojects).selectinload(SubProject.assignees),
        )
        .where(Project.id == project_id)
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프로젝트를 찾을 수 없습니다.",
        )

    participant_ids = list(dict.fromkeys(payload.participant_ids))
    participants = db.scalars(
        select(User)
        .where(User.id.in_(participant_ids), User.is_active.is_(True))
        .order_by(User.name.asc())
    ).all()
    if len(participants) != len(participant_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 프로젝트 참여 인원이 포함되어 있습니다.",
        )

    participant_id_set = {user.id for user in participants}
    invalid_assignees = [
        subproject.name
        for subproject in project.subprojects
        if any(user_id not in participant_id_set for user_id in _subproject_assignee_ids(subproject))
    ]
    if invalid_assignees:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "현재 배정된 하위 프로젝트 담당자가 새 참여 인원에 포함되지 않습니다: "
                + ", ".join(invalid_assignees[:3])
            ),
        )

    project.name = payload.name
    project.project_type = payload.project_type
    if "start_date" in payload.model_fields_set:
        project.start_date = payload.start_date
    if "end_date" in payload.model_fields_set:
        project.end_date = payload.end_date
    project.participants = participants
    db.commit()
    project = db.scalar(
        select(Project)
        .options(selectinload(Project.participants), selectinload(Project.subprojects))
        .where(Project.id == project.id)
    )
    return _serialize_project_response(project)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프로젝트를 찾을 수 없습니다.",
        )

    db.delete(project)
    db.commit()
    return None


@router.get("/projects/time-summary", response_model=list[ProjectTimeSummary])
def list_project_time_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    visible_project_ids = _get_visible_project_ids_for_user(db, current_user)
    if current_user.role != "admin" and not visible_project_ids:
        return []
    rows = db.execute(
        select(WorkLog, SubProject, User)
        .join(SubProject, WorkLog.subproject_id == SubProject.id)
        .join(User, WorkLog.user_id == User.id)
    ).all()

    per_project_user: dict[int, dict[int, dict[str, int | str]]] = defaultdict(dict)

    for work_log, subproject, user in rows:
        if current_user.role != "admin" and subproject.project_id not in visible_project_ids:
            continue
        duration_sec = work_log.duration_sec
        if work_log.status == WORKLOG_RUNNING and work_log.current_started_at:
            duration_sec += max(
                0,
                int((now - work_log.current_started_at).total_seconds()),
            )

        project_bucket = per_project_user.setdefault(subproject.project_id, {})
        member_bucket = project_bucket.get(user.id)
        if member_bucket is None:
            project_bucket[user.id] = {
                "user_name": user.name,
                "total_seconds": duration_sec,
            }
        else:
            member_bucket["total_seconds"] = int(member_bucket["total_seconds"]) + duration_sec

    summaries: list[ProjectTimeSummary] = []
    for project_id, members in per_project_user.items():
        member_summaries = sorted(
            [
                ProjectMemberTimeSummary(
                    user_id=user_id,
                    user_name=str(data["user_name"]),
                    total_seconds=int(data["total_seconds"]),
                )
                for user_id, data in members.items()
                if int(data["total_seconds"]) > 0
            ],
            key=lambda item: (-item.total_seconds, item.user_name),
        )

        summaries.append(
            ProjectTimeSummary(
                project_id=project_id,
                total_seconds=sum(member.total_seconds for member in member_summaries),
                members=member_summaries,
            )
        )

    summaries.sort(key=lambda item: item.project_id)
    return summaries


# ========== SubProjects ==========

@router.post(
    "/subprojects",
    response_model=SubProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_subproject(
    payload: SubProjectCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    project = db.scalar(
        select(Project)
        .options(selectinload(Project.participants))
        .where(Project.id == payload.project_id)
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프로젝트를 찾을 수 없습니다.",
        )

    assignees = _load_valid_assignees(
        db,
        project,
        _payload_assignee_ids(payload) or [],
    )

    sp = SubProject(
        project_id=project.id,
        name=payload.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=STATUS_PLANNED,
        progress=0,
    )
    _set_subproject_assignees(sp, assignees)

    # KEFICO 필드 복사
    _apply_kefico_fields(sp, payload)

    # 세부 태스크: 프로젝트 유형별 코드 내장 템플릿 적용
    task_source = [(name, float(w)) for name, w in _TEMPLATE_BY_TYPE.get(project.project_type, DEFAULT_SUBTASK_TEMPLATE)]

    for idx, (task_name, weight) in enumerate(task_source, start=1):
        sp.subtasks.append(
            SubTask(name=task_name, order_index=idx, weight=weight, is_done=False)
        )

    db.add(sp)
    db.commit()

    sp = _load_subproject(db, sp.id)
    return SubProjectResponse.from_orm_with_custom(sp)


@router.get("/subprojects", response_model=list[SubProjectResponse])
def list_subprojects(
    project_id: Optional[int] = Query(default=None),
    assignee_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(SubProject).options(
        selectinload(SubProject.subtasks),
        selectinload(SubProject.assignee),
        selectinload(SubProject.assignees),
        selectinload(SubProject.verifier),
        selectinload(SubProject.reviewer),
    )
    if current_user.role != "admin":
        visible_project_ids = _get_visible_project_ids_for_user(db, current_user)
        if not visible_project_ids:
            return []
        stmt = stmt.where(
            or_(
                SubProject.assignee_id == current_user.id,
                SubProject.id.in_(
                    select(subproject_assignees.c.subproject_id).where(
                        subproject_assignees.c.user_id == current_user.id
                    )
                ),
            ),
            SubProject.project_id.in_(visible_project_ids),
        )
    if project_id is not None:
        stmt = stmt.where(SubProject.project_id == project_id)
    if assignee_id is not None and current_user.role == "admin":
        stmt = stmt.where(
            or_(
                SubProject.assignee_id == assignee_id,
                SubProject.id.in_(
                    select(subproject_assignees.c.subproject_id).where(
                        subproject_assignees.c.user_id == assignee_id
                    )
                ),
            )
        )
    stmt = stmt.order_by(SubProject.start_date.asc())
    return [SubProjectResponse.from_orm_with_custom(sp) for sp in db.scalars(stmt).all()]


@router.get("/subprojects/{subproject_id}", response_model=SubProjectResponse)
def get_subproject(
    subproject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sp = _load_subproject(db, subproject_id)
    _ensure_subproject_access(sp, current_user)
    return SubProjectResponse.from_orm_with_custom(sp)


@router.put("/subprojects/{subproject_id}", response_model=SubProjectResponse)
def update_subproject(
    subproject_id: int,
    payload: SubProjectUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    sp = _load_subproject(db, subproject_id)
    project = db.scalar(
        select(Project)
        .options(selectinload(Project.participants))
        .where(Project.id == sp.project_id)
    )

    new_start = payload.start_date or sp.start_date
    new_end = payload.end_date or sp.end_date
    if new_end < new_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="종료일은 시작일 이후여야 합니다.",
        )

    if payload.name is not None:
        sp.name = payload.name
    next_assignee_ids = _payload_assignee_ids(payload)
    if next_assignee_ids is not None:
        _set_subproject_assignees(
            sp,
            _load_valid_assignees(db, project, next_assignee_ids),
        )
    if payload.start_date is not None:
        sp.start_date = payload.start_date
    if payload.end_date is not None:
        sp.end_date = payload.end_date

    # KEFICO 필드 반영
    _apply_kefico_fields(sp, payload)

    # verifier/reviewer FK 검증
    for fk_name in ("verifier_id", "reviewer_id"):
        val = getattr(sp, fk_name)
        if val is not None:
            ref = db.get(User, val)
            if not ref:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{fk_name} 사용자를 찾을 수 없습니다.",
                )

    if project is not None:
        _sync_subproject_execution_history(db, project, sp)
    db.commit()
    sp = _load_subproject(db, subproject_id)
    return SubProjectResponse.from_orm_with_custom(sp)


@router.delete(
    "/subprojects/{subproject_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_subproject(
    subproject_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    sp = _load_subproject(db, subproject_id)
    if sp.status == STATUS_COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="완료된 일정은 삭제할 수 없습니다.",
        )
    db.delete(sp)
    db.commit()
    return None


# ========== SubTasks ==========

@router.patch("/subtasks/{subtask_id}", response_model=SubTaskResponse)
def update_subtask(
    subtask_id: int,
    payload: SubTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.get(SubTask, subtask_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="세부 태스크를 찾을 수 없습니다.",
        )

    sp = _load_subproject(db, task.subproject_id)
    if current_user.role != "admin" and current_user.id not in _subproject_assignee_ids(sp):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인이 담당한 태스크만 변경할 수 있습니다.",
        )

    if payload.is_done is not None:
        task.is_done = payload.is_done
        task.done_at = datetime.now(timezone.utc) if payload.is_done else None
    if payload.name is not None and current_user.role == "admin":
        task.name = payload.name
    if payload.weight is not None and current_user.role == "admin":
        task.weight = payload.weight

    db.flush()
    _recalc_status_and_progress(sp)
    project = db.get(Project, sp.project_id)
    if project is not None:
        _sync_subproject_execution_history(db, project, sp)
    db.commit()
    db.refresh(task)
    return task


@router.get("/projects/history", response_model=list[ProjectHistoryEntry])
def list_project_execution_history(
    project_id: Optional[int] = Query(default=None),
    user_id: Optional[int] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    visible_project_ids = _get_visible_project_ids_for_user(db, current_user)
    if current_user.role != "admin" and not visible_project_ids:
        return []
    stmt = (
        select(ProjectExecutionHistory, User)
        .join(User, ProjectExecutionHistory.user_id == User.id)
        .order_by(
            ProjectExecutionHistory.ended_on.desc(),
            ProjectExecutionHistory.recorded_at.desc(),
        )
    )
    if current_user.role != "admin":
        stmt = stmt.where(
            ProjectExecutionHistory.project_id.in_(visible_project_ids),
            ProjectExecutionHistory.user_id == current_user.id,
        )
    if project_id is not None:
        stmt = stmt.where(ProjectExecutionHistory.project_id == project_id)
    if user_id is not None and current_user.role == "admin":
        stmt = stmt.where(ProjectExecutionHistory.user_id == user_id)
    if start_date is not None:
        stmt = stmt.where(ProjectExecutionHistory.ended_on >= start_date)
    if end_date is not None:
        stmt = stmt.where(ProjectExecutionHistory.ended_on <= end_date)

    rows = db.execute(stmt).all()
    return [_serialize_history_entry(history, user) for history, user in rows]


@router.post(
    "/projects/history",
    response_model=ProjectHistoryEntry,
    status_code=status.HTTP_201_CREATED,
)
def create_project_execution_history(
    payload: ProjectHistoryCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, payload.user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )

    subproject: SubProject | None = None
    project: Project | None = None
    if payload.subproject_id is not None:
        subproject = _load_subproject(db, payload.subproject_id)
        project = db.get(Project, subproject.project_id)
    elif payload.project_id is not None:
        project = db.get(Project, payload.project_id)
    if payload.project_id is not None and not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프로젝트를 찾을 수 없습니다.",
        )

    project_name = (payload.project_name or (project.name if project else None) or "").strip()
    if not project_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="프로젝트명을 입력해주세요.",
        )

    history = ProjectExecutionHistory(
        user_id=user.id,
        project_id=project.id if project else None,
        subproject_id=subproject.id if subproject else None,
        project_name=project_name,
        subproject_name=payload.subproject_name.strip(),
        project_type=project.project_type if project else payload.project_type,
        role_in_project="assignee",
        started_on=payload.started_on or (subproject.start_date if subproject else None),
        ended_on=payload.ended_on
        or (subproject.completed_on if subproject else None)
        or (subproject.end_date if subproject else None),
        worked_minutes=payload.worked_minutes,
        completion_rate=payload.completion_rate,
        keyword_text=payload.keyword_text
        or (_build_history_keywords(project, subproject) if subproject else project_name),
        manual_override=True,
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    return _serialize_history_entry(history, user)


@router.patch(
    "/projects/history/{history_id}",
    response_model=ProjectHistoryEntry,
)
def update_project_execution_history(
    history_id: int,
    payload: ProjectHistoryUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """관리자: 업무 이력 행 수동 편집. 편집 시 manual_override=True 로 표시되어
    이후 SubProject 변경에 의한 자동 동기화가 이 행을 덮어쓰지 않는다.
    """
    history = db.get(ProjectExecutionHistory, history_id)
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="업무 이력을 찾을 수 없습니다.",
        )

    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="수정할 필드가 없습니다.",
        )

    if "started_on" in data and "ended_on" in data:
        if data["started_on"] and data["ended_on"] and data["started_on"] > data["ended_on"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="시작일이 종료일보다 늦을 수 없습니다.",
            )
    elif "started_on" in data and history.ended_on:
        if data["started_on"] and data["started_on"] > history.ended_on:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="시작일이 종료일보다 늦을 수 없습니다.",
            )
    elif "ended_on" in data and history.started_on:
        if data["ended_on"] and history.started_on > data["ended_on"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="시작일이 종료일보다 늦을 수 없습니다.",
            )

    if "worked_minutes" in data and data["worked_minutes"] is not None and data["worked_minutes"] < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="소요 시간은 음수일 수 없습니다.",
        )

    for field, value in data.items():
        setattr(history, field, value)
    history.manual_override = True

    db.commit()
    db.refresh(history)
    user = db.get(User, history.user_id)
    return _serialize_history_entry(history, user)


@router.delete(
    "/projects/history/{history_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project_execution_history(
    history_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """관리자: 업무 이력 삭제. SubProject가 완료 상태로 재동기화되면 새 자동 행이
    생성될 수 있으나, 수동 편집된 행은 다시 만들어지지 않는다.
    """
    history = db.get(ProjectExecutionHistory, history_id)
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="업무 이력을 찾을 수 없습니다.",
        )
    db.delete(history)
    db.commit()
    return None


@router.get("/projects/history-summary", response_model=list[ProjectHistorySummary])
def list_project_execution_history_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    visible_project_ids = _get_visible_project_ids_for_user(db, current_user)
    if current_user.role != "admin" and not visible_project_ids:
        return []
    rows = db.execute(
        select(ProjectExecutionHistory, User).join(
            User, ProjectExecutionHistory.user_id == User.id
        )
    ).all()

    grouped: dict[int, dict[int, dict[str, object]]] = defaultdict(dict)
    for history, user in rows:
        if history.project_id is None:
            continue
        if current_user.role != "admin":
            if history.project_id not in visible_project_ids or history.user_id != current_user.id:
                continue
        project_bucket = grouped.setdefault(history.project_id, {})
        member_bucket = project_bucket.get(user.id)
        if member_bucket is None:
            project_bucket[user.id] = {
                "user_name": user.name,
                "completed_count": 1,
                "total_minutes": history.worked_minutes,
                "last_completed_on": history.ended_on,
            }
            continue

        member_bucket["completed_count"] = int(member_bucket["completed_count"]) + 1
        member_bucket["total_minutes"] = int(member_bucket["total_minutes"]) + int(history.worked_minutes)
        last_completed_on = member_bucket.get("last_completed_on")
        if history.ended_on and (
            last_completed_on is None or history.ended_on > last_completed_on
        ):
            member_bucket["last_completed_on"] = history.ended_on

    return [
        ProjectHistorySummary(
            project_id=project_id,
            total_completed_count=sum(
                int(member["completed_count"]) for member in members.values()
            ),
            members=sorted(
                [
                    ProjectHistoryMemberSummary(
                        user_id=user_id,
                        user_name=str(data["user_name"]),
                        completed_count=int(data["completed_count"]),
                        total_minutes=int(data["total_minutes"]),
                        last_completed_on=data["last_completed_on"],
                    )
                    for user_id, data in members.items()
                ],
                key=lambda item: (-item.completed_count, -item.total_minutes, item.user_name),
            ),
        )
        for project_id, members in sorted(grouped.items())
    ]


@router.post("/projects/history/backfill", status_code=status.HTTP_204_NO_CONTENT)
def backfill_project_execution_history(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    subprojects = db.scalars(
        select(SubProject)
        .options(selectinload(SubProject.subtasks))
        .where(SubProject.status == STATUS_COMPLETED)
    ).all()
    projects = {
        project.id: project
        for project in db.scalars(select(Project).where(Project.id.in_([sp.project_id for sp in subprojects]))).all()
    }
    for subproject in subprojects:
        project = projects.get(subproject.project_id)
        if project is None:
            continue
        _sync_subproject_execution_history(db, project, subproject)
    db.commit()
    return None


# ─────────────────────────────────────────────────────────────
#  ProgressLog 엔드포인트 (main_branch에서 병합)
#  사용자가 날짜별로 진행률(%)과 코멘트를 기록하는 업무 일지.
# ─────────────────────────────────────────────────────────────


@router.post(
    "/projects/{project_id}/progress",
    response_model=ProgressLogResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_progress_log(
    project_id: int,
    payload: ProgressLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """본인이 해당 프로젝트에서 오늘 한 일의 진행률을 기록한다."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프로젝트를 찾을 수 없습니다.",
        )

    progress_log = ProgressLog(
        project_id=project_id,
        user_id=current_user.id,
        progress_percent=payload.progress_percent,
        comment=payload.comment,
        work_date=payload.work_date,
    )
    db.add(progress_log)
    db.commit()
    db.refresh(progress_log)
    return progress_log


@router.get(
    "/projects/{project_id}/progress",
    response_model=list[ProgressLogResponse],
)
def list_project_progress_logs(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """본인이 이 프로젝트에 남긴 진행 기록 목록."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프로젝트를 찾을 수 없습니다.",
        )

    logs = db.scalars(
        select(ProgressLog)
        .where(
            ProgressLog.project_id == project_id,
            ProgressLog.user_id == current_user.id,
        )
        .order_by(ProgressLog.work_date.desc(), ProgressLog.id.desc())
    ).all()
    return logs
