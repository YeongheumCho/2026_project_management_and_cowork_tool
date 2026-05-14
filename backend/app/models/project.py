"""
Project / SubProject / SubTask 모델.

도메인 정의:
- Project: 최상위 프로젝트. project_type으로 업무 종류를 구분한다.
    * official_inspection  : 공식 검증 (차종 공식 검증)
    * regular_inspection   : 정기 검증 (정기 FW 검증)
    * change_inspection    : 변경점 검증
    * etc_task             : 기타 업무 (교육/휴가/출장/FAIL 유형 분류 등)
    * general              : (호환용) 일반 프로젝트
- SubProject: 프로젝트 하위의 "소프로젝트" 또는 개별 기능/업무 단위.
    - 공통: 담당자, 기간, 상태, 진척도, 기본 검증 메타 (제어기/LEVEL/TO 등)
    - 검증(공식/정기/변경점): 1차 검증 상태 + InReview 상태 및 시간 분리
    - 변경점 전용: CR.No, IP, LIN/STD/HOLD 메모 등
    - 기타업무 전용: 카테고리(교육/휴가/출장/FAIL분류), 월/일수/메모
- SubTask: 소프로젝트의 세부 태스크 (진척도 계산용).
"""
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


project_participants = Table(
    "project_participants",
    Base.metadata,
    Column("project_id", ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)

major_project_members = Table(
    "major_project_members",
    Base.metadata,
    Column("major_project_id", ForeignKey("major_projects.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)

subproject_assignees = Table(
    "subproject_assignees",
    Base.metadata,
    Column("subproject_id", ForeignKey("subprojects.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


# SubProject 상위 상태
STATUS_PLANNED = "planned"
STATUS_IN_PROGRESS = "in_progress"
STATUS_COMPLETED = "completed"

# 프로젝트 유형
PROJECT_TYPES = {
    "general",
    "official_inspection",
    "regular_inspection",
    "change_inspection",
    "etc_task",
}

# 검증 세부 상태 (1차 검증 / InReview 공용)
VERIFY_STATES = {
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
}

VERIFICATION_LEVELS = {"basic", "LV1", "LV2", "BSW", "LV3", "LV4"}

ETC_CATEGORIES = {"education", "vacation", "business_trip", "fail_classification", "other"}


class MajorProject(Base):
    __tablename__ = "major_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    kickoff_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    projects = relationship("Project", back_populates="major_project")
    members = relationship(
        "User",
        secondary=major_project_members,
        back_populates="major_projects",
    )


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    major_project_id: Mapped[int | None] = mapped_column(
        ForeignKey("major_projects.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    project_type: Mapped[str] = mapped_column(
        String(50), default="general", nullable=False
    )
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    major_project = relationship("MajorProject", back_populates="projects")
    subprojects = relationship(
        "SubProject",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    progress_logs = relationship(
        "ProgressLog",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    participants = relationship(
        "User",
        secondary=project_participants,
        back_populates="participating_projects",
    )


class SubProject(Base):
    __tablename__ = "subprojects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # 기능명 / 업무명
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    assignee_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=STATUS_PLANNED, nullable=False
    )
    progress: Mapped[float] = mapped_column(
        Numeric(5, 2), default=0, nullable=False
    )

    # ---------- 공통 검증 메타 (KEFICO 5층) ----------
    priority: Mapped[str] = mapped_column(String(20), nullable=True)            # 우선순위
    controller_name: Mapped[str] = mapped_column(String(100), nullable=True)    # 제어기명
    controller_version: Mapped[str] = mapped_column(String(100), nullable=True) # 버전 정보
    controller_country: Mapped[str] = mapped_column(String(50), nullable=True)  # 나라
    to_number: Mapped[str] = mapped_column(String(50), nullable=True)           # TO 번호
    to_assignee: Mapped[str] = mapped_column(String(50), nullable=True)         # TO 담당자
    verification_level: Mapped[str] = mapped_column(String(20), nullable=True)  # 기초/LV1/LV2/BSW/LV3/LV4
    vehicle_type: Mapped[str] = mapped_column(String(50), nullable=True)        # HEV/PHEV/CN8 LV2 등
    function_name: Mapped[str] = mapped_column(String(200), nullable=True)      # 기능명 (자세히)
    function_owner: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )    # 기능 담당자
    verifier_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )  # 검증(자동화) 담당자
    reviewer_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )  # 리뷰 담당자/리뷰 작성자
    seat_no: Mapped[str] = mapped_column(String(50), nullable=True)             # 검증 자리
    controller_no: Mapped[str] = mapped_column(String(50), nullable=True)       # 제어기 번호
    avg_expected_minutes: Mapped[int] = mapped_column(Integer, nullable=True)   # 평균 소요(분)
    issue_note: Mapped[str] = mapped_column(Text, nullable=True)                # 이슈/진행상황
    upload_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    special_note: Mapped[str] = mapped_column(Text, nullable=True)              # 특이사항
    completed_on: Mapped[date] = mapped_column(Date, nullable=True)             # 완료일

    # ---------- 검증 상태 & 시간 (1차 검증 / InReview) ----------
    first_verify_status: Mapped[str] = mapped_column(String(30), nullable=True)
    first_setup_min: Mapped[int] = mapped_column(Integer, nullable=True)
    first_aud_min: Mapped[int] = mapped_column(Integer, nullable=True)
    first_review_min: Mapped[int] = mapped_column(Integer, nullable=True)  # Review 작성/재검증

    inreview_status: Mapped[str] = mapped_column(String(30), nullable=True)
    inreview_setup_min: Mapped[int] = mapped_column(Integer, nullable=True)
    inreview_aud_min: Mapped[int] = mapped_column(Integer, nullable=True)
    inreview_feedback_min: Mapped[int] = mapped_column(Integer, nullable=True)  # 코디 피드백/재검증

    # ---------- 변경점 검증 전용 ----------
    cr_no: Mapped[str] = mapped_column(String(100), nullable=True)
    ip_addr: Mapped[str] = mapped_column(String(100), nullable=True)
    change_feedback_min: Mapped[int] = mapped_column(Integer, nullable=True)    # 검토/피드백 소요
    change_revalidate_min: Mapped[int] = mapped_column(Integer, nullable=True)  # 재검증 소요
    lin_std_hold_note: Mapped[str] = mapped_column(Text, nullable=True)         # LIN/STD/HOLD→FAIL 등

    # ---------- 기타 업무 전용 ----------
    etc_category: Mapped[str] = mapped_column(String(30), nullable=True)        # education/vacation/...
    etc_month: Mapped[str] = mapped_column(String(7), nullable=True)            # YYYY-MM
    etc_days: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)       # 소요일
    etc_note: Mapped[str] = mapped_column(Text, nullable=True)                  # 비고/상세

    # ---------- 커스텀 필드 (자유 형식 JSON) ----------
    custom_fields: Mapped[str] = mapped_column(Text, nullable=True)             # dict[str, Any] as JSON

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    project = relationship("Project", back_populates="subprojects")
    assignee = relationship(
        "User",
        back_populates="assigned_subprojects",
        foreign_keys=[assignee_id],
    )
    assignees = relationship(
        "User",
        secondary=subproject_assignees,
    )
    verifier = relationship("User", foreign_keys=[verifier_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    subtasks = relationship(
        "SubTask",
        back_populates="subproject",
        cascade="all, delete-orphan",
        order_by="SubTask.order_index",
    )

    @property
    def first_total_min(self) -> int:
        return sum(
            v or 0
            for v in (self.first_setup_min, self.first_aud_min, self.first_review_min)
        )

    @property
    def assignee_ids(self) -> list[int]:
        if self.assignees:
            return [user.id for user in self.assignees]
        return [] if self.assignee_id is None else [self.assignee_id]

    @property
    def inreview_total_min(self) -> int:
        return sum(
            v or 0
            for v in (
                self.inreview_setup_min,
                self.inreview_aud_min,
                self.inreview_feedback_min,
            )
        )

    @property
    def total_minutes(self) -> int:
        base = self.first_total_min + self.inreview_total_min
        if self.change_feedback_min:
            base += self.change_feedback_min
        if self.change_revalidate_min:
            base += self.change_revalidate_min
        return base


class SubTask(Base):
    __tablename__ = "subtasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    subproject_id: Mapped[int] = mapped_column(
        ForeignKey("subprojects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    weight: Mapped[float] = mapped_column(
        Numeric(5, 2), default=20, nullable=False
    )
    is_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    done_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    subproject = relationship("SubProject", back_populates="subtasks")


# 세부 태스크 기본 템플릿 (이름, 가중치)
DEFAULT_SUBTASK_TEMPLATE = [
    ("기획", 20),
    ("분석", 20),
    ("설계", 20),
    ("구현", 20),
    ("검증", 20),
]

# 검증 유형용 세부 템플릿 (1차 검증 + InReview 흐름)
INSPECTION_SUBTASK_TEMPLATE = [
    ("사전 준비", 15),
    ("1차 검증", 35),
    ("Review 작성", 10),
    ("InReview 반영", 30),
    ("업로드/완료", 10),
]

# 기타 업무용 (단순 체크리스트)
ETC_SUBTASK_TEMPLATE = [
    ("계획", 30),
    ("진행", 50),
    ("정리", 20),
]
