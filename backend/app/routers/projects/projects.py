import json
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.dependencies import get_current_user, get_db, require_admin
from app.models.project import STATUS_PLANNED, Project, SubProject, SubTask
from app.models.user import User
from app.models.workflow import WORKLOG_RUNNING, WorkLog
from app.schemas.project import (
    ProjectCreate,
    ProjectMemberTimeSummary,
    ProjectResponse,
    ProjectTimeSummary,
    ProjectUpdate,
)
from app.routers.projects._helpers import (
    _KEFICO_COPY_FIELDS,
    _ensure_project_type_allowed,
    _get_visible_project_ids_for_user,
    _load_major_project_for_user,
    _load_project_participants_for_major,
    _serialize_project_response,
    _subproject_assignee_ids,
)


router = APIRouter(tags=["projects"])

# 복사본에서는 "설정"만 가져오고 "진행 기록"은 새로 시작하도록 비우는 필드
_PROGRESS_RESET_FIELDS = {
    "first_verify_status",
    "first_setup_min",
    "first_aud_min",
    "first_review_min",
    "inreview_status",
    "inreview_setup_min",
    "inreview_aud_min",
    "inreview_feedback_min",
    "change_feedback_min",
    "change_revalidate_min",
    "issue_note",
    "completed_on",
}


# ========== Projects ==========

@router.post(
    "/projects",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    major_project = _load_major_project_for_user(db, payload.major_project_id, current_user)
    _ensure_project_type_allowed(major_project, payload.project_type)
    participants = _load_project_participants_for_major(db, major_project, payload.participant_ids)

    project = Project(
        major_project_id=major_project.id,
        name=payload.name,
        project_type=payload.project_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        vehicle_sets=json.dumps(
            [item.model_dump() for item in payload.vehicle_sets],
            ensure_ascii=False,
        ),
        created_by=current_user.id,
    )
    project.participants = participants
    db.add(project)
    db.commit()
    project = db.scalar(
        select(Project)
        .options(
            selectinload(Project.major_project),
            selectinload(Project.participants),
            selectinload(Project.subprojects).selectinload(SubProject.assignees),
        )
        .where(Project.id == project.id)
    )
    return _serialize_project_response(project)


@router.post(
    "/projects/{project_id}/duplicate",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def duplicate_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = db.scalar(
        select(Project)
        .options(
            selectinload(Project.participants),
            selectinload(Project.subprojects).options(
                selectinload(SubProject.assignees),
                selectinload(SubProject.verifiers),
                selectinload(SubProject.reviewers),
                selectinload(SubProject.inreviewers),
                selectinload(SubProject.subtasks),
            ),
        )
        .where(Project.id == project_id)
    )
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프로젝트를 찾을 수 없습니다.",
        )

    # 생성과 동일한 권한 규칙: 관리자이거나 해당 대프로젝트의 멤버
    if source.major_project_id is not None:
        _load_major_project_for_user(db, source.major_project_id, current_user)
    elif current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 프로젝트를 복사할 권한이 없습니다.",
        )

    copy = Project(
        major_project_id=source.major_project_id,
        name=f"{source.name} (복사본)",
        project_type=source.project_type,
        start_date=source.start_date,
        end_date=source.end_date,
        vehicle_sets=source.vehicle_sets,
        created_by=current_user.id,
    )
    copy.participants = list(source.participants)

    for sp in source.subprojects:
        new_sp = SubProject(
            name=sp.name,
            assignee_id=sp.assignee_id,
            start_date=sp.start_date,
            end_date=sp.end_date,
            status=STATUS_PLANNED,
            progress=0,
            custom_fields=sp.custom_fields,
            created_by=current_user.id,
        )
        for fname in _KEFICO_COPY_FIELDS:
            if fname in _PROGRESS_RESET_FIELDS:
                continue
            setattr(new_sp, fname, getattr(sp, fname))
        new_sp.upload_done = False
        new_sp.assignees = list(sp.assignees)
        new_sp.verifiers = list(sp.verifiers)
        new_sp.reviewers = list(sp.reviewers)
        new_sp.inreviewers = list(sp.inreviewers)
        for task in sp.subtasks:
            new_sp.subtasks.append(
                SubTask(
                    name=task.name,
                    order_index=task.order_index,
                    weight=task.weight,
                    is_done=False,
                )
            )
        copy.subprojects.append(new_sp)

    db.add(copy)
    db.commit()
    copy = db.scalar(
        select(Project)
        .options(
            selectinload(Project.major_project),
            selectinload(Project.participants),
            selectinload(Project.subprojects).selectinload(SubProject.assignees),
        )
        .where(Project.id == copy.id)
    )
    return _serialize_project_response(copy)


@router.get("/projects", response_model=list[ProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Project)
        .options(
            selectinload(Project.major_project),
            selectinload(Project.participants),
            selectinload(Project.subprojects),
        )
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
            selectinload(Project.major_project),
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

    major_project = _load_major_project_for_user(db, payload.major_project_id, _)
    _ensure_project_type_allowed(major_project, payload.project_type)
    # 이미 참여자로 등록된 사람은 퇴사(비활성)했어도 그대로 유지한다.
    # 그러지 않으면 퇴사자가 남은 프로젝트는 날짜 하나 바꾸는 것도 막힌다.
    existing_participant_ids = {user.id for user in project.participants}
    participants = _load_project_participants_for_major(
        db, major_project, payload.participant_ids, keep_ids=existing_participant_ids
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
    project.major_project_id = major_project.id
    project.project_type = payload.project_type
    if "start_date" in payload.model_fields_set:
        project.start_date = payload.start_date
    if "end_date" in payload.model_fields_set:
        project.end_date = payload.end_date
    project.vehicle_sets = json.dumps(
        [item.model_dump() for item in payload.vehicle_sets],
        ensure_ascii=False,
    )
    project.participants = participants
    db.commit()
    project = db.scalar(
        select(Project)
        .options(
            selectinload(Project.major_project),
            selectinload(Project.participants),
            selectinload(Project.subprojects),
        )
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

