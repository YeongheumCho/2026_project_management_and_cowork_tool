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
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
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
)
from app.models.user import User
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
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


def _apply_kefico_fields(sp: SubProject, payload) -> None:
    """payload에서 KEFICO 필드들 중 값이 들어온 것만 sp에 반영."""
    data = payload.model_dump(exclude_unset=True)
    for fname in _KEFICO_COPY_FIELDS:
        if fname in data:
            setattr(sp, fname, data[fname])


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
    project = Project(
        name=payload.name,
        project_type=payload.project_type,
        created_by=admin.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/projects", response_model=list[ProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.scalars(select(Project).order_by(Project.created_at.desc())).all()


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
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프로젝트를 찾을 수 없습니다.",
        )

    assignee = db.get(User, payload.assignee_id)
    if not assignee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="담당자를 찾을 수 없습니다.",
        )

    sp = SubProject(
        project_id=project.id,
        name=payload.name,
        assignee_id=assignee.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=STATUS_PLANNED,
        progress=0,
    )

    # KEFICO 필드 복사
    _apply_kefico_fields(sp, payload)

    # 프로젝트 유형에 따른 세부 태스크 템플릿 선택
    template = _TEMPLATE_BY_TYPE.get(project.project_type, DEFAULT_SUBTASK_TEMPLATE)
    for idx, (task_name, weight) in enumerate(template, start=1):
        sp.subtasks.append(
            SubTask(name=task_name, order_index=idx, weight=weight, is_done=False)
        )

    db.add(sp)
    db.commit()

    return _load_subproject(db, sp.id)


@router.get("/subprojects", response_model=list[SubProjectResponse])
def list_subprojects(
    project_id: Optional[int] = Query(default=None),
    assignee_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(SubProject).options(
        selectinload(SubProject.subtasks),
        selectinload(SubProject.assignee),
        selectinload(SubProject.verifier),
        selectinload(SubProject.reviewer),
    )
    if project_id is not None:
        stmt = stmt.where(SubProject.project_id == project_id)
    if assignee_id is not None:
        stmt = stmt.where(SubProject.assignee_id == assignee_id)
    stmt = stmt.order_by(SubProject.start_date.asc())
    return db.scalars(stmt).all()


@router.get("/subprojects/{subproject_id}", response_model=SubProjectResponse)
def get_subproject(
    subproject_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return _load_subproject(db, subproject_id)


@router.put("/subprojects/{subproject_id}", response_model=SubProjectResponse)
def update_subproject(
    subproject_id: int,
    payload: SubProjectUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    sp = _load_subproject(db, subproject_id)

    new_start = payload.start_date or sp.start_date
    new_end = payload.end_date or sp.end_date
    if new_end < new_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="종료일은 시작일 이후여야 합니다.",
        )

    if payload.name is not None:
        sp.name = payload.name
    if payload.assignee_id is not None:
        assignee = db.get(User, payload.assignee_id)
        if not assignee:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="담당자를 찾을 수 없습니다.",
            )
        sp.assignee_id = assignee.id
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

    db.commit()
    return _load_subproject(db, subproject_id)


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
    if current_user.role != "admin" and sp.assignee_id != current_user.id:
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
    db.commit()
    db.refresh(task)
    return task
