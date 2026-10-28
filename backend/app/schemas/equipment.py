import json
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_VALUE_LENGTH = 1000


def _clean_values(value: Any) -> Any:
    """{열 id: 값} 에서 앞뒤 공백을 지우고 빈 값은 뺀다. 빈칸은 '키 없음' 한 가지로 맞춘다."""
    if not isinstance(value, dict):
        return value
    cleaned: dict[str, str] = {}
    for key, raw in value.items():
        if raw is None:
            continue
        text = str(raw).strip()
        if not text:
            continue
        if len(text) > MAX_VALUE_LENGTH:
            raise ValueError(f"한 칸에는 {MAX_VALUE_LENGTH}자까지 입력할 수 있습니다.")
        cleaned[str(key)] = text
    return cleaned


class EquipmentColumnCreate(BaseModel):
    label: str = Field(min_length=1, max_length=100)

    @field_validator("label", mode="before")
    @classmethod
    def _strip(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class EquipmentColumnUpdate(EquipmentColumnCreate):
    pass


class EquipmentColumnOrder(BaseModel):
    column_ids: list[int] = Field(min_length=1)


class EquipmentColumnResponse(BaseModel):
    id: int
    label: str
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class EquipmentValues(BaseModel):
    values: dict[str, str] = Field(default_factory=dict)

    @field_validator("values", mode="before")
    @classmethod
    def _clean(cls, value: Any) -> Any:
        return _clean_values(value)


class EquipmentCreate(EquipmentValues):
    sort_order: Optional[int] = None


class EquipmentUpdate(EquipmentValues):
    # 화면이 읽어 간 버전. 그 사이 다른 사람이 저장했으면 409 로 막는다.
    version: int


class EquipmentBulkDelete(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=500)


class EquipmentBulkDeleteResult(BaseModel):
    deleted: int
    # 그 사이 다른 사람이 먼저 지운 줄 (오류로 보지 않는다)
    missing: int


class EquipmentBulkCreate(BaseModel):
    rows: list[EquipmentValues] = Field(min_length=1, max_length=500)


class EquipmentResponse(BaseModel):
    id: int
    values: dict[str, str]
    sort_order: int
    version: int
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class EquipmentHistoryResponse(BaseModel):
    id: int
    equipment_id: Optional[int] = None
    equipment_name: str
    action: str
    changes: dict[str, list[Optional[str]]] = Field(default_factory=dict)
    user_name: Optional[str] = None
    created_at: datetime

    @field_validator("changes", mode="before")
    @classmethod
    def _parse(cls, value: Any) -> Any:
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return {}
        return value or {}
