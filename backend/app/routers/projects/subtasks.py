from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.project import Project, SubTask
from app.models.user import User
from app.schemas.project import SubTaskResponse, SubTaskUpdate
from app.routers.projects._helpers import (
    _has_subproject_progress_logs,
    _load_subproject,
    _recalc_status_and_progress,
    _recalc_status_and_progress_from_logs,
    _subproject_assignee_ids,
    _sync_subproject_execution_history,
)


router = APIRouter(tags=["projects"])


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
    if _has_subproject_progress_logs(db, sp.id):
        _recalc_status_and_progress_from_logs(db, sp)
    else:
        _recalc_status_and_progress(sp)
    project = db.get(Project, sp.project_id)
    if project is not None:
        _sync_subproject_execution_history(db, project, sp)
    db.commit()
    db.refresh(task)
    return task

