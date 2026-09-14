from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.dependencies import get_current_user, get_db, require_admin
from app.models.project import (
    DEFAULT_SUBTASK_TEMPLATE,
    Project,
    STATUS_PLANNED,
    SubProject,
    SubTask,
    subproject_assignees,
)
from app.models.user import User
from app.schemas.project import SubProjectCreate, SubProjectResponse, SubProjectUpdate
from app.routers.projects._helpers import (
    _TEMPLATE_BY_TYPE,
    _apply_kefico_fields,
    _apply_role_assignments,
    _ensure_project_participant_write_access,
    _ensure_subproject_access,
    _get_member_project_ids_for_user,
    _has_subproject_progress_logs,
    _load_subproject,
    _load_valid_assignees,
    _payload_assignee_ids,
    _recalc_status_and_progress_from_logs,
    _set_subproject_assignees,
    _sync_subproject_execution_history,
    _validate_subproject_dates_within_project,
)


router = APIRouter(tags=["projects"])


# ========== SubProjects ==========

@router.post(
    "/subprojects",
    response_model=SubProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_subproject(
    payload: SubProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.scalar(
        select(Project)
        .options(selectinload(Project.participants))
        .where(Project.id == payload.project_id)
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.",
        )

    _ensure_project_participant_write_access(project, current_user)
    _validate_subproject_dates_within_project(
        project,
        payload.start_date,
        payload.end_date,
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

    # KEFICO ?꾨뱶 蹂듭궗
    _apply_kefico_fields(sp, payload)
    _apply_role_assignments(db, project, sp, payload)

    # ?몃? ?쒖뒪?? ?꾨줈?앺듃 ?좏삎蹂?肄붾뱶 ?댁옣 ?쒗뵆由??곸슜
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
        selectinload(SubProject.inreviewer),
        selectinload(SubProject.verifiers),
        selectinload(SubProject.reviewers),
        selectinload(SubProject.inreviewers),
    )
    if current_user.role != "admin":
        member_project_ids = _get_member_project_ids_for_user(db, current_user)
        assigned_subproject_ids = set(
            db.scalars(
                select(SubProject.id)
                .where(SubProject.assignee_id == current_user.id)
                .distinct()
            ).all()
        )
        assigned_subproject_ids |= set(
            db.scalars(
                select(subproject_assignees.c.subproject_id)
                .where(subproject_assignees.c.user_id == current_user.id)
                .distinct()
            ).all()
        )
        if not member_project_ids and not assigned_subproject_ids:
            return []
        visibility_filters = []
        if member_project_ids:
            visibility_filters.append(SubProject.project_id.in_(member_project_ids))
        if assigned_subproject_ids:
            visibility_filters.append(SubProject.id.in_(assigned_subproject_ids))
        stmt = stmt.where(or_(*visibility_filters))
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
    _ensure_subproject_access(db, sp, current_user)
    return SubProjectResponse.from_orm_with_custom(sp)


@router.put("/subprojects/{subproject_id}", response_model=SubProjectResponse)
def update_subproject(
    subproject_id: int,
    payload: SubProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sp = _load_subproject(db, subproject_id)
    project = db.scalar(
        select(Project)
        .options(selectinload(Project.participants))
        .where(Project.id == sp.project_id)
    )
    _ensure_project_participant_write_access(project, current_user)

    new_start = payload.start_date or sp.start_date
    new_end = payload.end_date or sp.end_date
    if new_end < new_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="醫낅즺?쇱? ?쒖옉???댄썑?ъ빞 ?⑸땲??",
        )

    _validate_subproject_dates_within_project(project, new_start, new_end)

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

    # KEFICO ?꾨뱶 諛섏쁺
    _apply_kefico_fields(sp, payload)
    _apply_role_assignments(db, project, sp, payload)

    # verifier/reviewer FK 寃利?
    for fk_name in ("function_owner", "verifier_id", "reviewer_id", "inreviewer_id"):
        val = getattr(sp, fk_name)
        if val is not None:
            ref = db.get(User, val)
            if not ref:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{fk_name} ?ъ슜?먮? 李얠쓣 ???놁뒿?덈떎.",
                )

    db.flush()
    if _has_subproject_progress_logs(db, sp.id):
        _recalc_status_and_progress_from_logs(db, sp)

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
    db.delete(sp)
    db.commit()
    return None

