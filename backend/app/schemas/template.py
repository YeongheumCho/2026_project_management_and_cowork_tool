import json
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    project_type: str = Field(min_length=1, max_length=50)
    trigger_keyword: str | None = Field(default=None, max_length=120)
    is_default: bool = False
    fields: dict[str, Any] = Field(default_factory=dict)


class TemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    project_type: str | None = Field(default=None, min_length=1, max_length=50)
    trigger_keyword: str | None = Field(default=None, max_length=120)
    is_default: bool | None = None
    fields: dict[str, Any] | None = None


class TemplateResponse(BaseModel):
    id: int
    name: str
    project_type: str
    trigger_keyword: str | None = None
    is_default: bool
    fields: dict[str, Any] = Field(default_factory=dict)
    created_by: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm(cls, obj: Any) -> "TemplateResponse":
        raw = obj.tasks_json or "{}"
        try:
            parsed = json.loads(raw)
            if not isinstance(parsed, dict):
                parsed = {}
        except (json.JSONDecodeError, TypeError):
            parsed = {}
        return cls(
            id=obj.id,
            name=obj.name,
            project_type=obj.project_type,
            trigger_keyword=obj.trigger_keyword,
            is_default=obj.is_default,
            fields=parsed,
            created_by=obj.created_by,
            created_at=obj.created_at,
        )
