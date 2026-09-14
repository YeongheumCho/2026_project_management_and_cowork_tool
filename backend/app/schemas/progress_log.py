"""
ProgressLog Pydantic 스키마.
"""
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ProgressLogCreate(BaseModel):
    progress_percent: int = Field(ge=0, le=100)
    comment: str | None = None
    work_date: date


class ProgressContribution(BaseModel):
    user_id: int
    user_name: str
    is_assignee: bool
    latest_percent: int | None = None
    work_date: date | None = None
    contributed_percent: float


class SubProjectProgressSummary(BaseModel):
    """하위 프로젝트 진행률이 담당자별 최신 기록의 평균으로 계산됨을 보여주는 요약."""

    subproject_id: int
    progress: float
    owner_count: int
    share_percent: float
    contributions: list[ProgressContribution]


class ProgressLogResponse(BaseModel):
    id: int
    project_id: int
    subproject_id: int | None = None
    user_id: int
    user_name: str | None = None
    progress_percent: int
    comment: str | None
    work_date: date
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
