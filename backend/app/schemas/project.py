"""
프로젝트/소프로젝트/세부 태스크용 Pydantic 스키마.

KEFICO 5층 업무 반영: 공식검증 / 정기검증 / 변경점검증 / 기타업무 유형별 필드.
"""
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


ProjectType = Literal[
    "general",
    "official_inspection",
    "regular_inspection",
    "change_inspection",
    "etc_task",
]

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

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    project_type: ProjectType = "general"


class ProjectResponse(BaseModel):
    id: int
    name: str
    project_type: str
    created_by: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


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


class SubProjectCreate(_SubProjectKeficoFields):
    project_id: int
    name: str = Field(min_length=1, max_length=200)
    assignee_id: int
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def _check_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("종료일은 시작일 이후여야 합니다.")
        return self


class SubProjectUpdate(_SubProjectKeficoFields):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    assignee_id: Optional[int] = None
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

    model_config = ConfigDict(from_attributes=True)
