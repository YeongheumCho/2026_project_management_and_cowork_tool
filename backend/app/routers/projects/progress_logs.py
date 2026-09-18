from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.project import Project
from app.models.progress_log import ProgressLog
from app.models.user import User
from app.schemas.progress_log import (
    ProgressContribution,
    ProgressLogCreate,
    ProgressLogResponse,
    SubProjectProgressSummary,
)
from app.routers.projects._helpers import (
    _can_edit_subproject_progress,
    _load_subproject,
    _recalc_status_and_progress_from_logs,
    _subproject_assignee_ids,
    _sync_subproject_execution_history,
)


router = APIRouter(tags=["projects"])


# ─────────────────────────────────────────────────────────────
#  ProgressLog 엔드포인트 (main_branch에서 병합)
#  사용자가 날짜별로 진행률(%)과 코멘트를 기록하는 업무 일지.
# ─────────────────────────────────────────────────────────────


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


@router.get(
    "/subprojects/{subproject_id}/progress/summary",
    response_model=SubProjectProgressSummary,
)
def get_subproject_progress_summary(
    subproject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """하위 프로젝트 진행률이 어떻게 계산됐는지(담당자별 최신 기록의 평균) 보여준다.

    _recalc_status_and_progress_from_logs 와 같은 규칙으로 계산하며,
    개별 기록 본문이 아닌 담당자별 최신 퍼센트만 노출하므로 참여 인원 누구나 볼 수 있다.
    """
    sp = _load_subproject(db, subproject_id)
    if not _can_edit_subproject_progress(db, sp, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="등록된 프로젝트 참여 인원만 하위 프로젝트 진행률 기록을 볼 수 있습니다.",
        )

    assignee_ids = _subproject_assignee_ids(sp)
    log_user_ids = set(
        db.scalars(
            select(ProgressLog.user_id)
            .where(ProgressLog.subproject_id == sp.id)
            .distinct()
        ).all()
    )
    owner_ids = sorted(assignee_ids | log_user_ids)
    if not owner_ids:
        return SubProjectProgressSummary(
            subproject_id=sp.id,
            progress=float(sp.progress),
            owner_count=0,
            share_percent=0,
            contributions=[],
        )

    logs = db.scalars(
        select(ProgressLog)
        .where(
            ProgressLog.subproject_id == sp.id,
            ProgressLog.user_id.in_(owner_ids),
        )
        .order_by(
            ProgressLog.user_id.asc(),
            ProgressLog.work_date.desc(),
            ProgressLog.id.desc(),
        )
    ).all()
    latest_by_user: dict[int, ProgressLog] = {}
    for log in logs:
        latest_by_user.setdefault(log.user_id, log)

    users_by_id = {
        user.id: user
        for user in db.scalars(select(User).where(User.id.in_(owner_ids))).all()
    }
    share = 100 / len(owner_ids)
    contributions = []
    for user_id in owner_ids:
        latest = latest_by_user.get(user_id)
        latest_percent = latest.progress_percent if latest else None
        contributions.append(
            ProgressContribution(
                user_id=user_id,
                user_name=users_by_id[user_id].name if user_id in users_by_id else f"#{user_id}",
                is_assignee=user_id in assignee_ids,
                latest_percent=latest_percent,
                work_date=latest.work_date if latest else None,
                contributed_percent=round(share * ((latest_percent or 0) / 100), 2),
            )
        )
    return SubProjectProgressSummary(
        subproject_id=sp.id,
        progress=float(sp.progress),
        owner_count=len(owner_ids),
        share_percent=round(share, 2),
        contributions=contributions,
    )


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
    """본인이 담당 프로젝트에서 오늘 한 일의 진행률을 기록한다."""
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
