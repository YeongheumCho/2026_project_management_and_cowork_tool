import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.models.workflow import ProjectFieldSchema
from app.schemas.field_schema import (
    ProjectFieldSchemaCreate,
    ProjectFieldSchemaResponse,
    ProjectFieldSchemaUpdate,
)

router = APIRouter(prefix="/field-schemas", tags=["field-schemas"])


def _empty_schema(project_type: str) -> ProjectFieldSchemaResponse:
    return ProjectFieldSchemaResponse(
        id=0,
        project_type=project_type,
        section_label="추가 정보",
        fields=[],
        weight=5,
        created_by=None,
        updated_at=datetime.now(timezone.utc),
    )


@router.get("", response_model=list[ProjectFieldSchemaResponse])
def list_field_schemas(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    schemas = db.scalars(
        select(ProjectFieldSchema).order_by(ProjectFieldSchema.project_type.asc())
    ).all()
    return [ProjectFieldSchemaResponse.from_orm(schema) for schema in schemas]


@router.get("/{project_type}", response_model=ProjectFieldSchemaResponse)
def get_field_schema(
    project_type: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    schema = db.scalar(
        select(ProjectFieldSchema).where(ProjectFieldSchema.project_type == project_type)
    )
    if schema is None:
        return _empty_schema(project_type)
    return ProjectFieldSchemaResponse.from_orm(schema)


@router.put("/{project_type}", response_model=ProjectFieldSchemaResponse)
def upsert_field_schema(
    project_type: str,
    payload: ProjectFieldSchemaCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    schema = db.scalar(
        select(ProjectFieldSchema).where(ProjectFieldSchema.project_type == project_type)
    )
    fields_json = json.dumps(
        [field.model_dump() for field in payload.fields], ensure_ascii=False
    )
    if schema is None:
        schema = ProjectFieldSchema(
            project_type=project_type,
            section_label=payload.section_label,
            fields_json=fields_json,
            weight=payload.weight,
            created_by=admin.id,
        )
        db.add(schema)
    else:
        schema.section_label = payload.section_label
        schema.fields_json = fields_json
        schema.weight = payload.weight

    db.commit()
    db.refresh(schema)
    return ProjectFieldSchemaResponse.from_orm(schema)


@router.patch("/{project_type}", response_model=ProjectFieldSchemaResponse)
def patch_field_schema(
    project_type: str,
    payload: ProjectFieldSchemaUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    schema = db.scalar(
        select(ProjectFieldSchema).where(ProjectFieldSchema.project_type == project_type)
    )
    if schema is None:
        schema = ProjectFieldSchema(
            project_type=project_type,
            section_label=payload.section_label or "추가 정보",
            fields_json=json.dumps(
                [field.model_dump() for field in (payload.fields or [])],
                ensure_ascii=False,
            ),
            weight=payload.weight if payload.weight is not None else 5,
            created_by=admin.id,
        )
        db.add(schema)
    else:
        if payload.section_label is not None:
            schema.section_label = payload.section_label
        if payload.fields is not None:
            schema.fields_json = json.dumps(
                [field.model_dump() for field in payload.fields], ensure_ascii=False
            )
        if payload.weight is not None:
            schema.weight = payload.weight

    db.commit()
    db.refresh(schema)
    return ProjectFieldSchemaResponse.from_orm(schema)


@router.delete("/{project_type}", status_code=status.HTTP_204_NO_CONTENT)
def delete_field_schema(
    project_type: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    schema = db.scalar(
        select(ProjectFieldSchema).where(ProjectFieldSchema.project_type == project_type)
    )
    if schema is not None:
        db.delete(schema)
        db.commit()
    return None
