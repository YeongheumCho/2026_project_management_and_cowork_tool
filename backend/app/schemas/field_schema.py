import json
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


FieldType = Literal["text", "number", "date", "select", "textarea", "checkbox"]


class FieldOption(BaseModel):
    label: str
    value: str


class FieldDefinition(BaseModel):
    key: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=100)
    field_type: FieldType = "text"
    options: list[FieldOption] = Field(default_factory=list)
    required: bool = False
    order: int = 0


class ProjectFieldSchemaCreate(BaseModel):
    project_type: str = Field(min_length=1, max_length=50)
    section_label: str = Field(default="추가 정보", min_length=1, max_length=100)
    fields: list[FieldDefinition] = Field(default_factory=list)
    weight: int = Field(default=5, ge=1, le=10)


class ProjectFieldSchemaUpdate(BaseModel):
    section_label: str | None = Field(default=None, min_length=1, max_length=100)
    fields: list[FieldDefinition] | None = None
    weight: int | None = Field(default=None, ge=1, le=10)


class ProjectFieldSchemaResponse(BaseModel):
    id: int
    project_type: str
    section_label: str
    fields: list[FieldDefinition] = Field(default_factory=list)
    weight: int = 5
    created_by: int | None = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm(cls, obj: Any) -> "ProjectFieldSchemaResponse":
        raw = obj.fields_json or "[]"
        try:
            parsed = json.loads(raw)
            if not isinstance(parsed, list):
                parsed = []
        except (json.JSONDecodeError, TypeError):
            parsed = []
        return cls(
            id=obj.id,
            project_type=obj.project_type,
            section_label=obj.section_label,
            fields=[FieldDefinition.model_validate(field) for field in parsed],
            weight=obj.weight if obj.weight is not None else 5,
            created_by=obj.created_by,
            updated_at=obj.updated_at,
        )
