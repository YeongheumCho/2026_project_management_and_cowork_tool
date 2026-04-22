from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


WorkLogStatus = Literal["running", "paused", "completed"]


class WorkQueueItem(BaseModel):
    id: int
    project_id: int
    project_name: str
    subproject_id: int
    subproject_name: str
    start_date: date
    end_date: date
    progress: float
    priority_hint: str


class WorkLogStart(BaseModel):
    subproject_id: int | None = None
    task_name: str = Field(min_length=1, max_length=200)
    continue_with_ids: list[int] = []


class WorkLogResponse(BaseModel):
    id: int
    user_id: int
    subproject_id: int | None
    task_name: str
    started_at: datetime
    current_started_at: datetime | None
    ended_at: datetime | None
    duration_sec: int
    status: WorkLogStatus
    session_group_id: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkLogComplete(BaseModel):
    archived_ids: list[int] = []


class RecommendationRequest(BaseModel):
    project_name: str = Field(min_length=1, max_length=200)
    project_type: str = Field(min_length=1, max_length=50)
    start_date: date
    end_date: date
    availability_weight: float = Field(default=0.5, ge=0, le=1)
    capability_weight: float = Field(default=0.5, ge=0, le=1)

    @model_validator(mode="after")
    def _validate(self):
        if self.end_date < self.start_date:
            raise ValueError("종료일은 시작일 이후여야 합니다.")
        total = round(self.availability_weight + self.capability_weight, 4)
        if total == 0:
            raise ValueError("가중치 합계는 0보다 커야 합니다.")
        self.availability_weight = self.availability_weight / total
        self.capability_weight = self.capability_weight / total
        return self


class RecommendationCandidate(BaseModel):
    user_id: int
    name: str
    role: str
    rank: int
    score: float
    availability_score: float
    capability_score: float
    remaining_minutes: int
    keyword_experience_count: int
    reasons: list[str]


class RecommendationResponse(BaseModel):
    request: RecommendationRequest
    candidates: list[RecommendationCandidate]


class AssignmentRequest(BaseModel):
    project_name: str = Field(min_length=1, max_length=200)
    project_type: str = Field(min_length=1, max_length=50)
    subproject_name: str = Field(min_length=1, max_length=200)
    assignee_id: int
    start_date: date
    end_date: date
    apply_template: bool = False

    @model_validator(mode="after")
    def _validate(self):
        if self.end_date < self.start_date:
            raise ValueError("종료일은 시작일 이후여야 합니다.")
        return self


class AssignmentResponse(BaseModel):
    project_id: int
    subproject_id: int
    assignee_id: int
    assigned_member_name: str


class UserSettingsUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=50)
    current_password: str | None = Field(default=None, min_length=8, max_length=128)
    new_password: str | None = Field(default=None, min_length=8, max_length=128)
    default_calendar_view: Literal["team", "personal"] | None = None
    notifications_enabled: bool | None = None

    @model_validator(mode="after")
    def _validate(self):
        if self.new_password and not self.current_password:
            raise ValueError("비밀번호 변경 시 현재 비밀번호가 필요합니다.")
        return self


class UserSettingsResponse(BaseModel):
    id: int
    idnum: str
    name: str
    role: str
    default_calendar_view: Literal["team", "personal"]
    notifications_enabled: bool


class TemplateTaskItem(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    weight: float = Field(ge=0, le=100)


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    project_type: str = Field(min_length=1, max_length=50)
    trigger_keyword: str | None = Field(default=None, max_length=120)
    is_default: bool = False
    tasks: list[TemplateTaskItem]

    @model_validator(mode="after")
    def _validate(self):
        total = round(sum(task.weight for task in self.tasks), 4)
        if self.tasks and total != 100:
            raise ValueError("템플릿 태스크 가중치 합은 100이어야 합니다.")
        return self


class TemplateResponse(BaseModel):
    id: int
    name: str
    project_type: str
    trigger_keyword: str | None
    is_default: bool
    tasks: list[TemplateTaskItem]
    created_by: int | None
    created_at: datetime
