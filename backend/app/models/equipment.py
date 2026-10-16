"""
장비 현황표 (HILS 검증·업무용 장비).

팀원 누구나 보고 고치는 공용 표다. 열(항목)도 누구나 추가·이름 변경·삭제·순서 변경한다.
그래서 열 정의는 equipment_columns 에 두고, 각 줄의 값은 {열 id: 값} JSON 으로 저장한다.
권한 구분이 없으므로 누가 무엇을 바꿨는지 EquipmentHistory 에 남긴다.
폐쇄망 전용이라 비밀번호 칸도 그대로 저장·표시한다 (2026-10-16 결정).
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

# 표가 처음 만들어질 때 넣는 기본 열. 시트16 순서 그대로이며 이후에는 누구나 바꿀 수 있다.
DEFAULT_EQUIPMENT_COLUMNS: tuple[str, ...] = (
    "장비",
    "장비 번호",
    "성명",
    "사번",
    "IP",
    "PC번호",
    "사용자",
    "제어기",
    "Prof",
    "582",
    "Daas",
    "내부",
    "비고",
)


class EquipmentColumn(Base):
    __tablename__ = "equipment_columns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # 같은 이름의 열이 두 개 생기지 않게 DB 에서도 막는다 (기본 열을 동시에 만드는 경우 포함).
    label: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Equipment(Base):
    __tablename__ = "equipment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # {"<열 id>": "값"}. 지운 열의 값은 남겨 두되 화면에는 나오지 않는다.
    values_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
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
    # 장비를 지워도 이력은 남겨야 하므로 외래키를 걸지 않는다. 열 변경 이력은 비어 있다.
    equipment_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    # 장비 줄이면 첫 열 값, 열 변경이면 "열: 이름"
    equipment_name: Mapped[str] = mapped_column(String(200), nullable=False)
    # create / update / delete / column_create / column_rename / column_delete / column_move
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    # {"열 이름": [이전 값, 새 값]}. 열 이름이 나중에 바뀌어도 읽을 수 있게 그때의 이름으로 남긴다.
    changes_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    user_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
