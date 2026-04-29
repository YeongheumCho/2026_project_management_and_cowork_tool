import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.models.workflow import ProjectTemplate
from app.schemas.template import TemplateCreate, TemplateResponse, TemplateUpdate

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=list[TemplateResponse])
def list_templates(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    templates = db.scalars(
        select(ProjectTemplate).order_by(
            ProjectTemplate.project_type.asc(),
            ProjectTemplate.is_default.desc(),
            ProjectTemplate.created_at.asc(),
        )
    ).all()
    return [TemplateResponse.from_orm(template) for template in templates]


@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    template = db.get(ProjectTemplate, template_id)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="템플릿을 찾을 수 없습니다.",
        )
    return TemplateResponse.from_orm(template)


@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: TemplateCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if payload.is_default:
        existing_defaults = db.scalars(
            select(ProjectTemplate).where(
                ProjectTemplate.project_type == payload.project_type,
                ProjectTemplate.is_default.is_(True),
            )
        ).all()
        for template in existing_defaults:
            template.is_default = False

    template = ProjectTemplate(
        name=payload.name,
        project_type=payload.project_type,
        trigger_keyword=payload.trigger_keyword or None,
        is_default=payload.is_default,
        tasks_json=json.dumps(payload.fields, ensure_ascii=False),
        created_by=admin.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return TemplateResponse.from_orm(template)


@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: int,
    payload: TemplateUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    template = db.get(ProjectTemplate, template_id)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="템플릿을 찾을 수 없습니다.",
        )

    next_project_type = payload.project_type or template.project_type

    if payload.name is not None:
        template.name = payload.name
    if payload.project_type is not None:
        template.project_type = payload.project_type
    if payload.trigger_keyword is not None:
        template.trigger_keyword = payload.trigger_keyword or None
    if payload.is_default is not None:
        if payload.is_default:
            others = db.scalars(
                select(ProjectTemplate).where(
                    ProjectTemplate.project_type == next_project_type,
                    ProjectTemplate.is_default.is_(True),
                    ProjectTemplate.id != template_id,
                )
            ).all()
            for other in others:
                other.is_default = False
        template.is_default = payload.is_default
    if payload.fields is not None:
        template.tasks_json = json.dumps(payload.fields, ensure_ascii=False)

    db.commit()
    db.refresh(template)
    return TemplateResponse.from_orm(template)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    template = db.get(ProjectTemplate, template_id)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="템플릿을 찾을 수 없습니다.",
        )
    db.delete(template)
    db.commit()
    return None
