from collections import defaultdict
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.dependencies import get_current_user, get_db, require_admin
from app.models.project import MajorProject, Project, STATUS_COMPLETED, SubProject
from app.models.user import User
from app.models.workflow import ProjectExecutionHistory
from app.schemas.project import (
    ProjectHistoryCreate,
    ProjectHistoryEntry,
    ProjectHistoryMemberSummary,
    ProjectHistorySummary,
    ProjectHistoryUpdate,
)
from app.routers.projects._helpers import (
    _build_history_keywords,
    _get_visible_project_ids_for_user,
    _load_stage_minutes_map,
    _load_subproject,
    _serialize_history_entry,
    _sync_subproject_execution_history,
)


router = APIRouter(tags=["projects"])


@router.get("/projects/history", response_model=list[ProjectHistoryEntry])
def list_project_execution_history(
    major_project_id: Optional[int] = Query(default=None),
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
        select(ProjectExecutionHistory, User, Project, MajorProject)
        .join(User, ProjectExecutionHistory.user_id == User.id)
        .outerjoin(Project, ProjectExecutionHistory.project_id == Project.id)
        .outerjoin(MajorProject, Project.major_project_id == MajorProject.id)
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
    if major_project_id is not None:
        stmt = stmt.where(Project.major_project_id == major_project_id)
    if project_id is not None:
        stmt = stmt.where(ProjectExecutionHistory.project_id == project_id)
    if user_id is not None and current_user.role == "admin":
        stmt = stmt.where(ProjectExecutionHistory.user_id == user_id)
    if start_date is not None:
        stmt = stmt.where(ProjectExecutionHistory.ended_on >= start_date)
    if end_date is not None:
        stmt = stmt.where(ProjectExecutionHistory.ended_on <= end_date)

    rows = db.execute(stmt).all()
    # B-82: 이력마다 어떤 검증 단계에 얼마가 들었는지 함께 내려준다.
    stage_map = _load_stage_minutes_map(
        db,
        [history.subproject_id for history, *_ in rows if history.subproject_id],
    )
    return [
        _serialize_history_entry(
            history,
            user,
            project,
            major_project,
            stage_map.get((history.user_id, history.subproject_id)),
        )
        for history, user, project, major_project in rows
    ]


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
    생성될 수 있으나, 수동 편집한 행은 다시 만들어지지 않는다.
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

