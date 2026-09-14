"""
하위 프로젝트 검증 시간 기록 (B-73 / B-74).

검증·리뷰·InReview 담당자는 여러 명을 배정할 수 있지만, 지금까지 시간은
SubProject 한 행의 칸(first_setup_min 등)에만 들어가서 누가 얼마나 썼는지
남지 않았다. 이 테이블은 그 시간을 사람·단계 단위로 한 줄씩 남긴다.

합계 규칙은 진행률과 같은 모양이다. 기록이 하나라도 있으면 그 합을 쓰고,
하나도 없으면 기존 칸 값을 그대로 쓴다. 그래서 이미 입력된 데이터는
건드리지 않고도 새 구조로 넘어갈 수 있다.
"""
from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


# 검증 단계 — 1차 검증 / InReview / 변경점 검증
STAGE_FIRST_VERIFY = "first_verify"
STAGE_INREVIEW = "inreview"
STAGE_CHANGE = "change"

TIME_ENTRY_STAGES = {STAGE_FIRST_VERIFY, STAGE_INREVIEW, STAGE_CHANGE}

STAGE_LABELS = {
    STAGE_FIRST_VERIFY: "1차 검증",
    STAGE_INREVIEW: "InReview",
    STAGE_CHANGE: "변경점 검증",
}

# 이 기록을 남긴 사람이 그 단계에서 맡은 역할
TIME_ENTRY_ROLES = {"verifier", "reviewer", "inreviewer", "assignee"}


class SubProjectTimeEntry(Base):
    __tablename__ = "subproject_time_entries"
    __table_args__ = (
        UniqueConstraint(
            "subproject_id",
            "user_id",
            "stage",
            name="uq_time_entry_subproject_user_stage",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    subproject_id: Mapped[int] = mapped_column(
        ForeignKey("subprojects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stage: Mapped[str] = mapped_column(String(20), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="verifier", nullable=False)

    setup_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    aud_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    work_min: Mapped[int | None] = mapped_column(Integer, nullable=True)

    state: Mapped[str | None] = mapped_column(String(30), nullable=True)
    issue_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    worked_on: Mapped[date | None] = mapped_column(Date, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User")
    subproject = relationship("SubProject", back_populates="time_entries")

    @property
    def user_name(self) -> str | None:
        return self.user.name if self.user else None

    @property
    def total_min(self) -> int:
        return sum(v or 0 for v in (self.setup_min, self.aud_min, self.work_min))
