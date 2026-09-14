import json
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.dependencies import get_current_user, get_db, require_admin
from app.models.project import Project, SubProject
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
    _ensure_project_type_allowed,
    _get_visible_project_ids_for_user,
    _load_major_project_for_user,
    _load_project_participants_for_major,
    _serialize_project_response,
    _subproject_assignee_ids,
)


router = APIRouter(tags=["projects"])


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
            detail="?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.",
        )

    major_project = _load_major_project_for_user(db, payload.major_project_id, _)
    _ensure_project_type_allowed(major_project, payload.project_type)
    participants = _load_project_participants_for_major(db, major_project, payload.participant_ids)

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
                "?꾩옱 諛곗젙???섏쐞 ?꾨줈?앺듃 ?대떦?먭? ??李몄뿬 ?몄썝???ы븿?섏? ?딆뒿?덈떎: "
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
            detail="?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.",
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

