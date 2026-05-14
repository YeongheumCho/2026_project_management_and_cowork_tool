from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    idnum: Mapped[str] = mapped_column(String(10), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # "admin" (관리자) | "member" (일반 직원)
    role: Mapped[str] = mapped_column(String(20), default="member", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # 조직도 확장 필드 (E-모빌리티센터 조직도 임포트 기반)
    center: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    office: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    team: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    position: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # relationships
    assigned_subprojects = relationship(
        "SubProject",
        back_populates="assignee",
        foreign_keys="SubProject.assignee_id",
    )
    participating_projects = relationship(
        "Project",
        secondary="project_participants",
        back_populates="participants",
    )
    major_projects = relationship(
        "MajorProject",
        secondary="major_project_members",
        back_populates="members",
    )
