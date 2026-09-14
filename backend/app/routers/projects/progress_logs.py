from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.project import Project
from app.models.progress_log import ProgressLog
from app.models.user import User
from app.schemas.progress_log import ProgressLogCreate, ProgressLogResponse
from app.routers.projects._helpers import (
    _can_edit_subproject_progress,
    _load_subproject,
    _recalc_status_and_progress_from_logs,
    _subproject_assignee_ids,
    _sync_subproject_execution_history,
)


router = APIRouter(tags=["projects"])


# ?????????????????????????????????????????????????????????????
#  ProgressLog ?붾뱶?ъ씤??(main_branch?먯꽌 蹂묓빀)
#  ?ъ슜?먭? ?좎쭨蹂꾨줈 吏꾪뻾瑜?%)怨?肄붾찘?몃? 湲곕줉?섎뒗 ?낅Т ?쇱?.
# ?????????????????????????????????????????????????????????????


@router.post(
    "/subprojects/{subproject_id}/progress",
    response_model=ProgressLogResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_subproject_progress_log(
    subproject_id: int,
    payload: ProgressLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sp = _load_subproject(db, subproject_id)
    assignee_ids = _subproject_assignee_ids(sp)
    if not _can_edit_subproject_progress(db, sp, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="등록된 프로젝트 참여 인원만 하위 프로젝트 진행률을 기록할 수 있습니다.",
        )

    progress_log = ProgressLog(
        project_id=sp.project_id,
        subproject_id=sp.id,
        user_id=current_user.id,
        progress_percent=payload.progress_percent,
        comment=payload.comment,
        work_date=payload.work_date,
    )
    db.add(progress_log)
    db.flush()
    _recalc_status_and_progress_from_logs(db, sp)
    project = db.get(Project, sp.project_id)
    if project is not None:
        _sync_subproject_execution_history(db, project, sp)
    db.commit()
    db.refresh(progress_log)
    return progress_log


@router.get(
    "/subprojects/{subproject_id}/progress",
    response_model=list[ProgressLogResponse],
)
def list_subproject_progress_logs(
    subproject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sp = _load_subproject(db, subproject_id)
    if not _can_edit_subproject_progress(db, sp, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="등록된 프로젝트 참여 인원만 하위 프로젝트 진행률 기록을 볼 수 있습니다.",
        )

    stmt = select(ProgressLog).where(ProgressLog.subproject_id == subproject_id)
    if current_user.role != "admin":
        stmt = stmt.where(ProgressLog.user_id == current_user.id)
    logs = db.scalars(
        stmt.order_by(ProgressLog.work_date.desc(), ProgressLog.id.desc())
    ).all()
    return logs


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
    """蹂몄씤???대떦 ?꾨줈?앺듃?먯꽌 ?ㅻ뒛 ???쇱쓽 吏꾪뻾瑜좎쓣 湲곕줉?쒕떎."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.",
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
    """蹂몄씤?????꾨줈?앺듃???④릿 吏꾪뻾 湲곕줉 紐⑸줉."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.",
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
