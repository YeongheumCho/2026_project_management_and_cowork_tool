"""
프로젝트/소프로젝트/세부 태스크용 Pydantic 스키마.

KEFICO 5층 업무 반영: 공식검증 / 정기검증 / 변경점검증 / 기타업무 유형별 필드.
"""
import json
from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


ProjectType = str

VerifyState = Literal[
    "not_started",
    "in_progress",
    "all_pass",
    "fail_issue",
    "pass_issue",
    "review_done",
    "inreview_waiting",
    "inreview_in_progress",
    "inreview_done",
    "uploaded",
]

VerificationLevel = Literal["basic", "LV1", "LV2", "BSW", "LV3", "LV4"]

EtcCategory = Literal[
    "education",
    "vacation",
    "business_trip",
    "fail_classification",
    "other",
]


# ---------- Project ----------

class ProjectParticipantBrief(BaseModel):
    id: int
    name: str
    center: str | None = None
    office: str | None = None
    team: str | None = None
    position: str | None = None

    model_config = ConfigDict(from_attributes=True)


class MajorProjectBrief(BaseModel):
    id: int
    name: str
    start_date: date | None = None
    end_date: date | None = None
    kickoff_date: date | None = None
    project_types: list[str] = Field(default_factory=list)
    is_default: bool = False

    model_config = ConfigDict(from_attributes=True)

    @field_validator("project_types", mode="before")
    @classmethod
    def _parse_project_types(cls, value: Any) -> list[str]:
        fallback = [
            "official_inspection",
            "regular_inspection",
            "change_inspection",
            "etc_task",
            "general",
        ]
        if value is None:
            return fallback
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError:
                return fallback
            value = parsed
        if not isinstance(value, list):
            return fallback
        result = [item.strip() for item in value if isinstance(item, str) and item.strip()]
        return list(dict.fromkeys(result)) or fallback


class MajorProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    kickoff_date: date | None = None
    project_types: list[str] = Field(default_factory=lambda: [
        "official_inspection",
        "regular_inspection",
        "change_inspection",
        "etc_task",
        "general",
    ])
    member_ids: list[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def _check_dates(self):
        if self.start_date is not None and self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("종료일은 시작일 이후여야 합니다")
        return self

    @field_validator("project_types")
    @classmethod
    def _check_project_types(cls, value: list[str]) -> list[str]:
        unique = list(dict.fromkeys(item.strip() for item in value if item.strip()))
        if not unique:
            raise ValueError("프로젝트 유형을 1개 이상 선택해주세요.")
        return unique


class MajorProjectUpdate(MajorProjectCreate):
    pass


class MajorProjectResponse(MajorProjectBrief):
    members: list[ProjectParticipantBrief] = []
    project_count: int = 0
    created_at: datetime


class ProjectCreate(BaseModel):
    major_project_id: int
    name: str = Field(min_length=1, max_length=200)
    project_type: ProjectType = "general"
    participant_ids: list[int] = Field(min_length=1)
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def _check_dates(self):
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("종료일은 시작일 이후여야 합니다.")
        return self


class ProjectUpdate(BaseModel):
    major_project_id: int
    name: str = Field(min_length=1, max_length=200)
    project_type: ProjectType = "general"
    participant_ids: list[int] = Field(min_length=1)
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def _check_dates(self):
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("종료일은 시작일 이후여야 합니다.")
        return self


class ProjectResponse(BaseModel):
    id: int
    major_project_id: int | None = None
    major_project: MajorProjectBrief | None = None
    name: str
    project_type: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_by: Optional[int] = None
    created_at: datetime
    participants: list[ProjectParticipantBrief] = []
    progress_percent: float = 0
    subproject_count: int = 0
    completed_subproject_count: int = 0
    in_progress_subproject_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ProjectMemberTimeSummary(BaseModel):
    user_id: int
    user_name: str
    total_seconds: int


class ProjectTimeSummary(BaseModel):
    project_id: int
    total_seconds: int
    members: list[ProjectMemberTimeSummary]


class ProjectHistoryEntry(BaseModel):
    id: int
    user_id: int
    user_name: str
    project_id: int | None = None
    project_name: str
    subproject_id: int | None = None
    subproject_name: str
    project_type: str
    role_in_project: str
    started_on: date | None = None
    ended_on: date | None = None
    worked_minutes: int
    completion_rate: float
    recorded_at: datetime
    manual_override: bool = False


class ProjectHistoryCreate(BaseModel):
    user_id: int
    project_id: Optional[int] = None
    project_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    project_type: str = Field(default="manual", min_length=1, max_length=50)
    subproject_id: Optional[int] = None
    subproject_name: str = Field(min_length=1, max_length=200)
    started_on: Optional[date] = None
    ended_on: Optional[date] = None
    worked_minutes: int = Field(default=0, ge=0)
    completion_rate: float = Field(default=100, ge=0, le=100)
    keyword_text: Optional[str] = None

    @model_validator(mode="after")
    def _check_dates(self):
        if self.subproject_id is None and not (self.project_name or "").strip():
            raise ValueError("프로젝트명을 입력해주세요.")
        if (
            self.started_on is not None
            and self.ended_on is not None
            and self.started_on > self.ended_on
        ):
            raise ValueError("시작일이 종료일보다 늦을 수 없습니다.")
        return self


class ProjectHistoryUpdate(BaseModel):
    """관리자가 업무 이력 행을 수동 편집할 때 사용. 모든 필드 옵션."""

    subproject_name: Optional[str] = None
    started_on: Optional[date] = None
    ended_on: Optional[date] = None
    worked_minutes: Optional[int] = None
    keyword_text: Optional[str] = None


class ProjectHistoryMemberSummary(BaseModel):
    user_id: int
    user_name: str
    completed_count: int
    total_minutes: int
    last_completed_on: date | None = None


class ProjectHistorySummary(BaseModel):
    project_id: int
    total_completed_count: int
    members: list[ProjectHistoryMemberSummary]


# ---------- SubTask ----------

class SubTaskResponse(BaseModel):
    id: int
    name: str
    order_index: int
    weight: float
    is_done: bool
    done_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SubTaskUpdate(BaseModel):
    is_done: Optional[bool] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    weight: Optional[float] = Field(default=None, ge=0, le=100)


# ---------- SubProject ----------

class _SubProjectKeficoFields(BaseModel):
    """KEFICO 5층 업무용 공통 선택 필드 (create/update 공유)."""

    # 공통 메타
    priority: Optional[str] = Field(default=None, max_length=20)
    controller_name: Optional[str] = Field(default=None, max_length=100)
    controller_version: Optional[str] = Field(default=None, max_length=100)
    controller_country: Optional[str] = Field(default=None, max_length=50)
    to_number: Optional[str] = Field(default=None, max_length=50)
    to_assignee: Optional[str] = Field(default=None, max_length=50)
    verification_level: Optional[VerificationLevel] = None
    vehicle_type: Optional[str] = Field(default=None, max_length=50)
    function_name: Optional[str] = Field(default=None, max_length=200)
    function_owner: Optional[str] = Field(default=None, max_length=100)
    verifier_id: Optional[int] = None
    reviewer_id: Optional[int] = None
    seat_no: Optional[str] = Field(default=None, max_length=50)
    controller_no: Optional[str] = Field(default=None, max_length=50)
    avg_expected_minutes: Optional[int] = Field(default=None, ge=0)
    issue_note: Optional[str] = None
    upload_done: Optional[bool] = None
    special_note: Optional[str] = None
    completed_on: Optional[date] = None

    # 1차 검증 / InReview 상태·시간
    first_verify_status: Optional[VerifyState] = None
    first_setup_min: Optional[int] = Field(default=None, ge=0)
    first_aud_min: Optional[int] = Field(default=None, ge=0)
    first_review_min: Optional[int] = Field(default=None, ge=0)

    inreview_status: Optional[VerifyState] = None
    inreview_setup_min: Optional[int] = Field(default=None, ge=0)
    inreview_aud_min: Optional[int] = Field(default=None, ge=0)
    inreview_feedback_min: Optional[int] = Field(default=None, ge=0)

    # 변경점 검증 전용
    cr_no: Optional[str] = Field(default=None, max_length=100)
    ip_addr: Optional[str] = Field(default=None, max_length=100)
    change_feedback_min: Optional[int] = Field(default=None, ge=0)
    change_revalidate_min: Optional[int] = Field(default=None, ge=0)
    lin_std_hold_note: Optional[str] = None

    # 기타 업무 전용
    etc_category: Optional[EtcCategory] = None
    etc_month: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}$")
    etc_days: Optional[float] = Field(default=None, ge=0)
    etc_note: Optional[str] = None

    # 커스텀 필드 (자유 형식)
    custom_fields: Optional[dict[str, Any]] = None


class SubProjectCreate(_SubProjectKeficoFields):
    project_id: int
    name: str = Field(min_length=1, max_length=200)
    assignee_id: Optional[int] = None
    assignee_ids: list[int] | None = None
    start_date: date
    end_date: date
    @model_validator(mode="after")
    def _check_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("종료일은 시작일 이후여야 합니다.")
        if not self.assignee_ids and self.assignee_id is None:
            raise ValueError("담당자를 1명 이상 선택해주세요.")
        return self


class SubProjectUpdate(_SubProjectKeficoFields):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    assignee_id: Optional[int] = None
    assignee_ids: list[int] | None = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @model_validator(mode="after")
    def _check_dates(self):
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("종료일은 시작일 이후여야 합니다.")
        return self


class AssigneeBrief(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class SubProjectResponse(BaseModel):
    id: int
    project_id: int
    name: str
    assignee_id: Optional[int] = None
    assignee: Optional[AssigneeBrief] = None
    assignee_ids: list[int] = []
    assignees: list[AssigneeBrief] = []
    start_date: date
    end_date: date
    status: str
    progress: float
    subtasks: list[SubTaskResponse] = []
    created_at: datetime
    updated_at: datetime

    # KEFICO 공통 메타
    priority: Optional[str] = None
    controller_name: Optional[str] = None
    controller_version: Optional[str] = None
    controller_country: Optional[str] = None
    to_number: Optional[str] = None
    to_assignee: Optional[str] = None
    verification_level: Optional[str] = None
    vehicle_type: Optional[str] = None
    function_name: Optional[str] = None
    function_owner: Optional[str] = None
    verifier_id: Optional[int] = None
    verifier: Optional[AssigneeBrief] = None
    reviewer_id: Optional[int] = None
    reviewer: Optional[AssigneeBrief] = None
    seat_no: Optional[str] = None
    controller_no: Optional[str] = None
    avg_expected_minutes: Optional[int] = None
    issue_note: Optional[str] = None
    upload_done: bool = False
    special_note: Optional[str] = None
    completed_on: Optional[date] = None

    first_verify_status: Optional[str] = None
    first_setup_min: Optional[int] = None
    first_aud_min: Optional[int] = None
    first_review_min: Optional[int] = None
    first_total_min: int = 0

    inreview_status: Optional[str] = None
    inreview_setup_min: Optional[int] = None
    inreview_aud_min: Optional[int] = None
    inreview_feedback_min: Optional[int] = None
    inreview_total_min: int = 0

    total_minutes: int = 0

    cr_no: Optional[str] = None
    ip_addr: Optional[str] = None
    change_feedback_min: Optional[int] = None
    change_revalidate_min: Optional[int] = None
    lin_std_hold_note: Optional[str] = None

    etc_category: Optional[str] = None
    etc_month: Optional[str] = None
    etc_days: Optional[float] = None
    etc_note: Optional[str] = None

    custom_fields: Optional[dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("custom_fields", mode="before")
    @classmethod
    def _parse_custom_fields(cls, value: Any) -> Optional[dict[str, Any]]:
        if value is None or isinstance(value, dict):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError:
                return None
            return parsed if isinstance(parsed, dict) else None
        return None

    @classmethod
    def from_orm_with_custom(cls, sp: Any) -> "SubProjectResponse":
        return cls.model_validate(sp)
