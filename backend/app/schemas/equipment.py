import json
import re
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


_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
MIN_COLUMN_WIDTH = 60
MAX_COLUMN_WIDTH = 800


def _clean_formats(value: Any) -> Any:
    """{열 id: {bg, fg, bold}} 에서 쓸 수 있는 값만 남긴다. 서식이 없는 칸은 키를 뺀다."""
    if value is None:
        return {}
    if not isinstance(value, dict):
        return value
    cleaned: dict[str, dict[str, Any]] = {}
    for key, raw in value.items():
        if not isinstance(raw, dict):
            continue
        cell: dict[str, Any] = {}
        for name in ("bg", "fg"):
            color = raw.get(name)
            if color is None or color == "":
                continue
            if not isinstance(color, str) or not _COLOR_RE.match(color):
                raise ValueError("색은 #RRGGBB 형식이어야 합니다.")
            cell[name] = color.lower()
        if raw.get("bold") is True:
            cell["bold"] = True
        if cell:
            cleaned[str(key)] = cell
    return cleaned


class EquipmentBoardBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    # 같은 장비를 쓰는 대프로젝트. 비우면 모든 사람이 본다.
    major_project_ids: list[int] = Field(default_factory=list)

    @field_validator("name", mode="before")
    @classmethod
    def _strip(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class EquipmentBoardCreate(EquipmentBoardBase):
    # 주면 그 그룹의 열 구성을 그대로 가져와 시작한다 (줄은 가져오지 않는다).
    copy_columns_from: Optional[int] = None


class EquipmentBoardUpdate(EquipmentBoardBase):
    pass


class EquipmentBoardMajorProject(BaseModel):
    id: int
    name: str


class EquipmentBoardResponse(BaseModel):
    id: int
    name: str
    is_default: bool
    major_projects: list[EquipmentBoardMajorProject] = Field(default_factory=list)
    row_count: int = 0


class EquipmentColumnWidth(BaseModel):
    # None 이면 기본 너비로 되돌린다.
    width: Optional[int] = Field(default=None, ge=MIN_COLUMN_WIDTH, le=MAX_COLUMN_WIDTH)


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
    width: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class EquipmentValues(BaseModel):
    values: dict[str, str] = Field(default_factory=dict)
    # B-109: 칸 서식. 보내지 않으면(None) 서식은 그대로 둔다.
    formats: Optional[dict[str, dict[str, Any]]] = None

    @field_validator("values", mode="before")
    @classmethod
    def _clean(cls, value: Any) -> Any:
        return _clean_values(value)

    @field_validator("formats", mode="before")
    @classmethod
    def _clean_formats(cls, value: Any) -> Any:
        return None if value is None else _clean_formats(value)


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
    formats: dict[str, dict[str, Any]] = Field(default_factory=dict)
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
