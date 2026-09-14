"""
하위 프로젝트 검증 시간 기록 스키마 (B-73 / B-74).
"""
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.time_entry import TIME_ENTRY_ROLES, TIME_ENTRY_STAGES


class SubProjectTimeEntryUpsert(BaseModel):
    """한 사람이 한 단계에 쓴 시간. 같은 단계로 다시 보내면 기존 줄을 갱신한다."""

    stage: str
    role: str = "verifier"
    setup_min: int | None = Field(default=None, ge=0)
    aud_min: int | None = Field(default=None, ge=0)
    work_min: int | None = Field(default=None, ge=0)
    state: str | None = None
    issue_note: str | None = None
    worked_on: date | None = None
    # 관리자가 다른 사람 몫을 대신 입력할 때만 쓴다. 비우면 본인 기록.
    user_id: int | None = None

    @field_validator("stage")
    @classmethod
    def _check_stage(cls, value: str) -> str:
        if value not in TIME_ENTRY_STAGES:
            raise ValueError("검증 단계 값이 올바르지 않습니다.")
        return value

    @field_validator("role")
    @classmethod
    def _check_role(cls, value: str) -> str:
        if value not in TIME_ENTRY_ROLES:
            raise ValueError("역할 값이 올바르지 않습니다.")
        return value


class SubProjectTimeEntryResponse(BaseModel):
    id: int
    subproject_id: int
    user_id: int
    user_name: str | None = None
    stage: str
    role: str
    setup_min: int | None = None
    aud_min: int | None = None
    work_min: int | None = None
    total_min: int
    state: str | None = None
    issue_note: str | None = None
    worked_on: date | None = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StageTotal(BaseModel):
    stage: str
    stage_label: str
    total_min: int
    person_count: int
    # 담당자별 기록이 없어 기존 칸 값을 그대로 쓰고 있는 단계
    from_legacy: bool


class SubProjectTimeSummary(BaseModel):
    """하위 프로젝트의 단계별 합계와 사람별 기록."""

    subproject_id: int
    total_min: int
    stages: list[StageTotal]
    entries: list[SubProjectTimeEntryResponse]
