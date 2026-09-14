"""
하위 프로젝트 검증 시간 기록 엔드포인트 (B-73 / B-74).

  GET    /subprojects/{id}/time-entries   단계별 합계 + 사람별 기록
  PUT    /subprojects/{id}/time-entries   본인 기록 저장(같은 단계면 갱신)
  DELETE /subprojects/{id}/time-entries/{entry_id}
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.dependencies import get_current_user, get_db
from app.models.project import Project
from app.models.time_entry import (
    STAGE_CHANGE,
    STAGE_FIRST_VERIFY,
    STAGE_INREVIEW,
    STAGE_LABELS,
    SubProjectTimeEntry,
)
from app.models.user import User
from app.schemas.time_entry import (
    StageTotal,
    SubProjectTimeEntryResponse,
    SubProjectTimeEntryUpsert,
    SubProjectTimeSummary,
)
from app.routers.projects._helpers import (
    _can_edit_subproject_progress,
    _load_subproject,
    _sync_subproject_execution_history,
)


router = APIRouter(tags=["projects"])


_STAGE_ORDER = (STAGE_FIRST_VERIFY, STAGE_INREVIEW, STAGE_CHANGE)

_NO_ACCESS = "등록된 프로젝트 참여 인원만 검증 시간을 보거나 기록할 수 있습니다."


def _load_entries(db: Session, subproject_id: int) -> list[SubProjectTimeEntry]:
    return list(
        db.scalars(
            select(SubProjectTimeEntry)
            .options(selectinload(SubProjectTimeEntry.user))
            .where(SubProjectTimeEntry.subproject_id == subproject_id)
            .order_by(
                SubProjectTimeEntry.stage.asc(),
                SubProjectTimeEntry.user_id.asc(),
            )
        ).all()
    )


def _legacy_stage_total(sp, stage: str) -> int:
    """담당자별 기록이 없을 때 쓰는 기존 칸 합계."""
    if stage == STAGE_FIRST_VERIFY:
        values = (sp.first_setup_min, sp.first_aud_min, sp.first_review_min)
    elif stage == STAGE_INREVIEW:
        values = (sp.inreview_setup_min, sp.inreview_aud_min, sp.inreview_feedback_min)
    else:
        values = (sp.change_feedback_min, sp.change_revalidate_min)
    return sum(v or 0 for v in values)


def _build_summary(sp, entries: list[SubProjectTimeEntry]) -> SubProjectTimeSummary:
    stages: list[StageTotal] = []
    for stage in _STAGE_ORDER:
        stage_entries = [entry for entry in entries if entry.stage == stage]
        if stage_entries:
            total = sum(entry.total_min for entry in stage_entries)
            from_legacy = False
        else:
            total = _legacy_stage_total(sp, stage)
            from_legacy = True
        stages.append(
            StageTotal(
                stage=stage,
                stage_label=STAGE_LABELS[stage],
                total_min=total,
                person_count=len(stage_entries),
                from_legacy=from_legacy,
            )
        )
    return SubProjectTimeSummary(
        subproject_id=sp.id,
        total_min=sum(item.total_min for item in stages),
        stages=stages,
        entries=[
            SubProjectTimeEntryResponse.model_validate(entry) for entry in entries
        ],
    )


@router.get(
    "/subprojects/{subproject_id}/time-entries",
    response_model=SubProjectTimeSummary,
)
def get_subproject_time_entries(
    subproject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sp = _load_subproject(db, subproject_id)
    if not _can_edit_subproject_progress(db, sp, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_NO_ACCESS,
        )
    return _build_summary(sp, _load_entries(db, sp.id))


@router.put(
    "/subprojects/{subproject_id}/time-entries",
    response_model=SubProjectTimeSummary,
)
def upsert_subproject_time_entry(
    subproject_id: int,
    payload: SubProjectTimeEntryUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """본인 몫의 검증 시간을 저장한다. 같은 단계로 다시 보내면 그 줄을 갱신한다."""
    sp = _load_subproject(db, subproject_id)
    if not _can_edit_subproject_progress(db, sp, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_NO_ACCESS,
        )

    target_user_id = current_user.id
    if payload.user_id is not None and payload.user_id != current_user.id:
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="다른 사람의 검증 시간은 관리자만 대신 입력할 수 있습니다.",
            )
        target_user = db.get(User, payload.user_id)
        if target_user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="사용자를 찾을 수 없습니다.",
            )
        target_user_id = payload.user_id

    entry = db.scalar(
        select(SubProjectTimeEntry).where(
            SubProjectTimeEntry.subproject_id == sp.id,
            SubProjectTimeEntry.user_id == target_user_id,
            SubProjectTimeEntry.stage == payload.stage,
        )
    )
    if entry is None:
        entry = SubProjectTimeEntry(
            subproject_id=sp.id,
            user_id=target_user_id,
            stage=payload.stage,
        )
        db.add(entry)

    entry.role = payload.role
    entry.setup_min = payload.setup_min
    entry.aud_min = payload.aud_min
    entry.work_min = payload.work_min
    entry.state = payload.state
    entry.issue_note = payload.issue_note
    entry.worked_on = payload.worked_on

    db.flush()
    db.refresh(sp)
    project = db.get(Project, sp.project_id)
    if project is not None:
        _sync_subproject_execution_history(db, project, sp)
    db.commit()

    sp = _load_subproject(db, subproject_id)
    return _build_summary(sp, _load_entries(db, sp.id))


@router.delete(
    "/subprojects/{subproject_id}/time-entries/{entry_id}",
    response_model=SubProjectTimeSummary,
)
def delete_subproject_time_entry(
    subproject_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sp = _load_subproject(db, subproject_id)
    if not _can_edit_subproject_progress(db, sp, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_NO_ACCESS,
        )

    entry = db.get(SubProjectTimeEntry, entry_id)
    if entry is None or entry.subproject_id != sp.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="검증 시간 기록을 찾을 수 없습니다.",
        )
    if entry.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="다른 사람의 검증 시간은 관리자만 지울 수 있습니다.",
        )

    db.delete(entry)
    db.flush()
    db.refresh(sp)
    project = db.get(Project, sp.project_id)
    if project is not None:
        _sync_subproject_execution_history(db, project, sp)
    db.commit()

    sp = _load_subproject(db, subproject_id)
    return _build_summary(sp, _load_entries(db, sp.id))
