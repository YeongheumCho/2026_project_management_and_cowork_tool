"""
장비 현황표 (HILS 검증·업무용 장비).

팀원 누구나 보고 고치는 공용 표다. 권한 구분이 없으므로
누가 무엇을 바꿨는지 EquipmentHistory 에 남긴다.
폐쇄망 전용이라 비밀번호 칸도 그대로 저장·표시한다 (2026-10-16 결정).
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

# 표의 열 순서 그대로. 화면·CSV·이력이 이 목록을 함께 쓴다.
EQUIPMENT_FIELDS: tuple[str, ...] = (
    "name",
    "equipment_no",
    "owner_name",
    "owner_idnum",
    "ip",
    "pc_no",
    "user_name",
    "controller",
    "prof",
    "col_582",
    "daas_password",
    "internal_password",
    "note",
)


class Equipment(Base):
    __tablename__ = "equipment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    equipment_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    owner_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    owner_idnum: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pc_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    controller: Mapped[str | None] = mapped_column(String(100), nullable=True)
    prof: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # 시트 머리글이 숫자 "582" 그대로라 뜻을 확인하기 전까지 이름을 붙이지 않는다.
    col_582: Mapped[str | None] = mapped_column(String(100), nullable=True)
    daas_password: Mapped[str | None] = mapped_column(String(200), nullable=True)
    internal_password: Mapped[str | None] = mapped_column(String(200), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 동시 수정 확인용. 저장할 때마다 1씩 오른다.
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class EquipmentHistory(Base):
    __tablename__ = "equipment_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # 장비를 지워도 이력은 남겨야 하므로 외래키를 걸지 않는다.
    equipment_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    equipment_name: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(20), nullable=False)  # create / update / delete
    # {"필드": [이전 값, 새 값]} 를 JSON 문자열로
    changes_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    user_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
