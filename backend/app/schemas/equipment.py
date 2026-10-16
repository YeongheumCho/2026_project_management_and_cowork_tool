import json
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EquipmentFields(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    equipment_no: Optional[str] = Field(default=None, max_length=50)
    owner_name: Optional[str] = Field(default=None, max_length=100)
    owner_idnum: Optional[str] = Field(default=None, max_length=50)
    ip: Optional[str] = Field(default=None, max_length=100)
    pc_no: Optional[str] = Field(default=None, max_length=50)
    user_name: Optional[str] = Field(default=None, max_length=100)
    controller: Optional[str] = Field(default=None, max_length=100)
    prof: Optional[str] = Field(default=None, max_length=100)
    col_582: Optional[str] = Field(default=None, max_length=100)
    daas_password: Optional[str] = Field(default=None, max_length=200)
    internal_password: Optional[str] = Field(default=None, max_length=200)
    note: Optional[str] = None

    @field_validator("*", mode="before")
    @classmethod
    def _strip(cls, value: Any) -> Any:
        # 빈 칸은 None 으로 저장해 "비어 있음"을 한 가지로 맞춘다.
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class EquipmentCreate(EquipmentFields):
    sort_order: Optional[int] = None


class EquipmentUpdate(EquipmentFields):
    # 화면이 읽어 간 버전. 그 사이 다른 사람이 저장했으면 409 로 막는다.
    version: int


class EquipmentBulkCreate(BaseModel):
    rows: list[EquipmentFields] = Field(min_length=1, max_length=500)


class EquipmentResponse(EquipmentFields):
    id: int
    sort_order: int
    version: int
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    # 응답은 저장된 값을 그대로 돌려준다 (이름이 비어 있던 옛 행도 막지 않음).
    name: str


class EquipmentHistoryResponse(BaseModel):
    id: int
    equipment_id: int
    equipment_name: str
    action: str
    changes: dict[str, list[Optional[str]]] = Field(default_factory=dict)
    user_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("changes", mode="before")
    @classmethod
    def _parse(cls, value: Any) -> Any:
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return {}
        return value or {}
