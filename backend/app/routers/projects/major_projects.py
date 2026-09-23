import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.dependencies import get_current_user, get_db, require_admin
from app.models.project import MajorProject, Project
from app.models.user import User
from app.schemas.project import MajorProjectCreate, MajorProjectResponse, MajorProjectUpdate
from app.routers.projects._helpers import (
    _load_major_project_members,
    _serialize_major_project_response,
)


router = APIRouter(tags=["projects"])


# ========== Major Projects ==========

@router.get("/major-projects", response_model=list[MajorProjectResponse])
def list_major_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(MajorProject)
        .options(selectinload(MajorProject.members), selectinload(MajorProject.projects))
        .order_by(MajorProject.created_at.desc())
    )
    if current_user.role != "admin":
        stmt = stmt.where(MajorProject.members.any(User.id == current_user.id))
    return [_serialize_major_project_response(item) for item in db.scalars(stmt).all()]


@router.post(
    "/major-projects",
    response_model=MajorProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_major_project(
    payload: MajorProjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    members = _load_major_project_members(db, payload.member_ids)
    major_project = MajorProject(
        name=payload.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        kickoff_date=payload.kickoff_date,
        project_types=json.dumps(payload.project_types, ensure_ascii=False),
        is_default=False,
    )
    major_project.members = members
    db.add(major_project)
    db.commit()
    db.refresh(major_project)
    major_project = db.scalar(
        select(MajorProject)
        .options(selectinload(MajorProject.members), selectinload(MajorProject.projects))
        .where(MajorProject.id == major_project.id)
    )
    return _serialize_major_project_response(major_project)


@router.put("/major-projects/{major_project_id}", response_model=MajorProjectResponse)
def update_major_project(
    major_project_id: int,
    payload: MajorProjectUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    major_project = db.scalar(
        select(MajorProject)
        .options(
            selectinload(MajorProject.members),
            selectinload(MajorProject.projects).selectinload(Project.participants),
        )
        .where(MajorProject.id == major_project_id)
    )
    if not major_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="대프로젝트를 찾을 수 없습니다.",
        )

    next_project_types = list(dict.fromkeys(payload.project_types))
    project_types_in_use = {
        project.project_type
        for project in major_project.projects
    }
    removed_types_in_use = sorted(project_types_in_use - set(next_project_types))
    if removed_types_in_use:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 해당 유형의 프로젝트가 있어 유형을 삭제할 수 없습니다.",
        )

    # Existing project participants must remain valid members of the major
    # project. Preserve them automatically so name/date/type edits are not
    # blocked by older or partially synced membership data.
    required_member_ids = {
        participant.id
        for project in major_project.projects
        for participant in project.participants
    }
    members = _load_major_project_members(
        db,
        list(dict.fromkeys([*payload.member_ids, *required_member_ids])),
    )

    major_project.name = payload.name
    major_project.start_date = payload.start_date
    major_project.end_date = payload.end_date
    major_project.kickoff_date = payload.kickoff_date
    major_project.project_types = json.dumps(next_project_types, ensure_ascii=False)
    major_project.members = members
    db.commit()
    major_project = db.scalar(
        select(MajorProject)
        .options(selectinload(MajorProject.members), selectinload(MajorProject.projects))
        .where(MajorProject.id == major_project.id)
    )
    return _serialize_major_project_response(major_project)


@router.delete("/major-projects/{major_project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_major_project(
    major_project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    major_project = db.scalar(
        select(MajorProject)
        .options(selectinload(MajorProject.projects))
        .where(MajorProject.id == major_project_id)
    )
    if not major_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="대프로젝트를 찾을 수 없습니다.",
        )
    if major_project.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="기본 대프로젝트는 삭제할 수 없습니다.",
        )
    if major_project.projects:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="소속 중프로젝트가 있는 대프로젝트는 삭제할 수 없습니다.",
        )
    db.delete(major_project)
    db.commit()
    return None

