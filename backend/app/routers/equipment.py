"""
장비 현황표 API.

관리자·일반 구분 없이, 볼 수 있는 그룹의 줄과 열(항목)은 누구나 추가·수정·삭제할 수 있다.
대신 모든 변경을 equipment_history 에 남기고,
두 사람이 같은 줄을 동시에 고치면 나중 저장을 막아 덮어쓰기를 피한다.

B-112: 표는 '장비 그룹'(board) 단위로 나뉜다. 같은 장비를 쓰는 대프로젝트를 묶어
그룹을 만들고(관리자), 그 대프로젝트에 속한 사람만 그 그룹을 본다.
연결된 대프로젝트가 없는 그룹은 모든 사람이 본다 (그룹이 생기기 전의 기본 표 포함).
board_id 를 주지 않으면 기본 그룹을 쓴다.
"""
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_admin
from app.models.equipment import (
    DEFAULT_EQUIPMENT_BOARD_NAME,
    DEFAULT_EQUIPMENT_COLUMNS,
    Equipment,
    EquipmentBoard,
    EquipmentColumn,
    EquipmentHistory,
)
from app.models.project import MajorProject, Project, major_project_members, project_participants
from app.models.user import User
from app.schemas.equipment import (
    EquipmentBoardCreate,
    EquipmentBoardMajorProject,
    EquipmentBoardResponse,
    EquipmentBoardUpdate,
    EquipmentBulkCreate,
    EquipmentBulkDelete,
    EquipmentBulkDeleteResult,
    EquipmentColumnCreate,
    EquipmentColumnOrder,
    EquipmentColumnResponse,
    EquipmentColumnUpdate,
    EquipmentColumnWidth,
    EquipmentCreate,
    EquipmentHistoryResponse,
    EquipmentResponse,
    EquipmentUpdate,
    EquipmentValues,
)

router = APIRouter(prefix="/equipment", tags=["equipment"])

UNNAMED = "(이름 없음)"


# ── 그룹(board) ─────────────────────────────────────────────────────


def _default_board(db: Session) -> EquipmentBoard:
    board = db.scalar(select(EquipmentBoard).where(EquipmentBoard.is_default.is_(True)))
    if board:
        return board
    # 처음 쓰는 DB: 기본 그룹을 만든다. 두 요청이 동시에 오면 이름 고유 제약으로 한쪽만 남는다.
    db.add(EquipmentBoard(name=DEFAULT_EQUIPMENT_BOARD_NAME, is_default=True))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return db.scalar(select(EquipmentBoard).where(EquipmentBoard.is_default.is_(True)))


def _user_major_project_ids(db: Session, user: User) -> set[int]:
    """내가 들어가 있는 대프로젝트: 대프로젝트 참여 인원이거나, 그 아래 프로젝트의 참여 인원."""
    ids = set(
        db.scalars(
            select(major_project_members.c.major_project_id).where(
                major_project_members.c.user_id == user.id
            )
        ).all()
    )
    ids |= {
        major_id
        for major_id in db.scalars(
            select(Project.major_project_id)
            .join(project_participants, project_participants.c.project_id == Project.id)
            .where(project_participants.c.user_id == user.id)
        ).all()
        if major_id is not None
    }
    return ids


def _can_see(board: EquipmentBoard, user: User, my_major_ids: set[int]) -> bool:
    if user.role == "admin" or not board.major_projects:
        return True
    return any(major.id in my_major_ids for major in board.major_projects)


def _board_or_404(db: Session, board_id: int) -> EquipmentBoard:
    board = db.get(EquipmentBoard, board_id)
    if board is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="장비 그룹을 찾을 수 없습니다. 삭제되었을 수 있습니다. 새로고침해 주세요.",
        )
    return board


def _board_for(db: Session, board_id: int | None, user: User) -> EquipmentBoard:
    """요청이 가리키는 그룹. 볼 수 없는 그룹이면 403."""
    board = _default_board(db) if board_id is None else _board_or_404(db, board_id)
    if not _can_see(board, user, _user_major_project_ids(db, user)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 장비 현황은 연결된 프로젝트의 참여 인원만 볼 수 있습니다.",
        )
    return board


def _board_response(db: Session, board: EquipmentBoard) -> EquipmentBoardResponse:
    return EquipmentBoardResponse(
        id=board.id,
        name=board.name,
        is_default=board.is_default,
        major_projects=[
            EquipmentBoardMajorProject(id=major.id, name=major.name)
            for major in sorted(board.major_projects, key=lambda item: item.id)
        ],
        row_count=db.scalar(
            select(func.count()).select_from(Equipment).where(Equipment.board_id == board.id)
        )
        or 0,
    )


def _load_major_projects(db: Session, ids: list[int]) -> list[MajorProject]:
    unique_ids = list(dict.fromkeys(ids))
    if not unique_ids:
        return []
    majors = list(db.scalars(select(MajorProject).where(MajorProject.id.in_(unique_ids))).all())
    if len(majors) != len(unique_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="선택한 대프로젝트 중 없는 것이 있습니다. 새로고침한 뒤 다시 골라 주세요.",
        )
    return majors


def _duplicate_board(name: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"'{name}' 장비 그룹이 이미 있습니다. 다른 이름을 써 주세요.",
    )


def _ensure_unique_board_name(db: Session, name: str, own_id: int | None = None) -> None:
    existing = db.scalar(select(EquipmentBoard).where(EquipmentBoard.name == name))
    if existing and existing.id != own_id:
        raise _duplicate_board(name)


@router.get("/boards", response_model=list[EquipmentBoardResponse])
def list_boards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """내가 볼 수 있는 그룹. 기본 그룹이 맨 앞이다."""
    _default_board(db)
    my_major_ids = _user_major_project_ids(db, current_user)
    boards = db.scalars(
        select(EquipmentBoard).order_by(EquipmentBoard.is_default.desc(), EquipmentBoard.id)
    ).all()
    return [
        _board_response(db, board)
        for board in boards
        if _can_see(board, current_user, my_major_ids)
    ]


@router.post("/boards", response_model=EquipmentBoardResponse, status_code=status.HTTP_201_CREATED)
def create_board(
    payload: EquipmentBoardCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    _ensure_unique_board_name(db, payload.name)
    board = EquipmentBoard(name=payload.name, is_default=False, created_by=admin.id)
    board.major_projects = _load_major_projects(db, payload.major_project_ids)
    db.add(board)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise _duplicate_board(payload.name) from exc
    if payload.copy_columns_from is not None:
        source = _board_or_404(db, payload.copy_columns_from)
        for column in _load_columns(db, source):
            db.add(
                EquipmentColumn(
                    board_id=board.id,
                    label=column.label,
                    sort_order=column.sort_order,
                    width=column.width,
                )
            )
    db.commit()
    db.refresh(board)
    return _board_response(db, board)


@router.put("/boards/{board_id}", response_model=EquipmentBoardResponse)
def update_board(
    board_id: int,
    payload: EquipmentBoardUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    board = _board_or_404(db, board_id)
    _ensure_unique_board_name(db, payload.name, own_id=board.id)
    board.name = payload.name
    board.major_projects = _load_major_projects(db, payload.major_project_ids)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise _duplicate_board(payload.name) from exc
    db.refresh(board)
    return _board_response(db, board)


@router.delete("/boards/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_board(
    board_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    board = _board_or_404(db, board_id)
    if board.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="기본 장비 현황은 지울 수 없습니다.",
        )
    row_count = db.scalar(
        select(func.count()).select_from(Equipment).where(Equipment.board_id == board.id)
    )
    if row_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"장비가 {row_count}줄 남아 있습니다. 줄을 모두 지운 뒤 그룹을 삭제해 주세요.",
        )
    for column in _load_columns(db, board):
        db.delete(column)
    db.delete(board)
    db.commit()


# ── 공통 ───────────────────────────────────────────────────────────


def _load_columns(db: Session, board: EquipmentBoard) -> list[EquipmentColumn]:
    return list(
        db.scalars(
            select(EquipmentColumn)
            .where(EquipmentColumn.board_id == board.id)
            .order_by(EquipmentColumn.sort_order, EquipmentColumn.id)
        ).all()
    )


def _columns(db: Session, board: EquipmentBoard) -> list[EquipmentColumn]:
    columns = _load_columns(db, board)
    if columns:
        return columns
    # 처음 쓰는 표: 시트16 열로 시작한다. 마지막 열은 지울 수 없으므로 다시 비지 않는다.
    # 화면은 열과 줄을 동시에 읽으므로 두 요청이 함께 여기 올 수 있다.
    # 한 그룹 안에서 열 이름이 고유라서 늦은 쪽은 실패하고, 먼저 만든 열을 다시 읽는다.
    db.add_all(
        EquipmentColumn(board_id=board.id, label=label, sort_order=index)
        for index, label in enumerate(DEFAULT_EQUIPMENT_COLUMNS)
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return _load_columns(db, board)


def _json_dict(raw: str | None) -> dict[str, Any]:
    try:
        data = json.loads(raw or "{}")
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def _values(equipment: Equipment) -> dict[str, str]:
    return _json_dict(equipment.values_json)


def _formats(equipment: Equipment) -> dict[str, dict[str, Any]]:
    return _json_dict(equipment.formats_json)


def _row_name(values: dict[str, str], columns: list[EquipmentColumn]) -> str:
    """이력에 남길 줄 이름: 앞쪽 열부터 처음 채워진 값."""
    for column in columns:
        value = values.get(str(column.id))
        if value:
            return value[:200]
    return UNNAMED


def _response(equipment: Equipment, columns: list[EquipmentColumn]) -> EquipmentResponse:
    visible = {str(column.id) for column in columns}
    return EquipmentResponse(
        id=equipment.id,
        values={key: value for key, value in _values(equipment).items() if key in visible},
        formats={key: value for key, value in _formats(equipment).items() if key in visible},
        sort_order=equipment.sort_order,
        version=equipment.version,
        updated_by=equipment.updated_by,
        updated_by_name=equipment.updated_by_name,
        created_at=equipment.created_at,
        updated_at=equipment.updated_at,
    )


def _log(
    db: Session,
    *,
    board: EquipmentBoard,
    action: str,
    name: str,
    changes: dict[str, list[str | None]],
    user: User,
    equipment_id: int | None = None,
) -> None:
    db.add(
        EquipmentHistory(
            board_id=board.id,
            equipment_id=equipment_id,
            equipment_name=name,
            action=action,
            changes_json=json.dumps(changes, ensure_ascii=False),
            user_id=user.id,
            user_name=user.name,
        )
    )


def _visible_values(payload: EquipmentValues, columns: list[EquipmentColumn]) -> dict[str, str]:
    """지금 있는 열의 값만 받는다. 그 사이 지워진 열의 값은 버린다."""
    ids = {str(column.id) for column in columns}
    return {key: value for key, value in payload.values.items() if key in ids}


def _visible_formats(
    payload: EquipmentValues, columns: list[EquipmentColumn]
) -> dict[str, dict[str, Any]] | None:
    """보내지 않았으면 None (서식을 건드리지 않는다)."""
    if payload.formats is None:
        return None
    ids = {str(column.id) for column in columns}
    return {key: value for key, value in payload.formats.items() if key in ids}


def _format_text(cell: dict[str, Any] | None) -> str | None:
    """이력에 남길 서식 설명."""
    if not cell:
        return None
    parts = []
    if cell.get("bg"):
        parts.append(f"칸 색 {cell['bg']}")
    if cell.get("fg"):
        parts.append(f"글자 색 {cell['fg']}")
    if cell.get("bold"):
        parts.append("굵게")
    return ", ".join(parts) or None


def _diff(
    before: dict[str, str], after: dict[str, str], columns: list[EquipmentColumn]
) -> dict[str, list[str | None]]:
    return {
        column.label: [before.get(str(column.id)), after.get(str(column.id))]
        for column in columns
        if before.get(str(column.id)) != after.get(str(column.id))
    }


def _format_diff(
    before: dict[str, dict[str, Any]],
    after: dict[str, dict[str, Any]],
    columns: list[EquipmentColumn],
) -> dict[str, list[str | None]]:
    return {
        f"{column.label} 서식": [
            _format_text(before.get(str(column.id))),
            _format_text(after.get(str(column.id))),
        ]
        for column in columns
        if (before.get(str(column.id)) or None) != (after.get(str(column.id)) or None)
    }


def _get_or_404(db: Session, equipment_id: int) -> Equipment:
    equipment = db.get(Equipment, equipment_id)
    if equipment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="장비를 찾을 수 없습니다. 다른 사람이 삭제했을 수 있습니다. 새로고침해 주세요.",
        )
    return equipment


def _column_or_404(db: Session, column_id: int) -> EquipmentColumn:
    column = db.get(EquipmentColumn, column_id)
    if column is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="열을 찾을 수 없습니다. 다른 사람이 지웠을 수 있습니다. 새로고침해 주세요.",
        )
    return column


def _duplicate_label(label: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"'{label}' 열이 이미 있습니다. 다른 이름을 써 주세요.",
    )


def _ensure_unique_label(columns: list[EquipmentColumn], label: str, own_id: int | None = None) -> None:
    for column in columns:
        if column.id != own_id and column.label == label:
            raise _duplicate_label(label)


def _commit_label(db: Session, label: str) -> None:
    """두 사람이 같은 이름을 동시에 넣으면 DB 고유 제약에 걸린다. 그때도 같은 안내를 준다."""
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise _duplicate_label(label) from exc


# ── 열(항목) ─────────────────────────────────────────────────────────


@router.get("/columns", response_model=list[EquipmentColumnResponse])
def list_columns(
    board_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _columns(db, _board_for(db, board_id, current_user))


@router.post("/columns", response_model=EquipmentColumnResponse, status_code=status.HTTP_201_CREATED)
def create_column(
    payload: EquipmentColumnCreate,
    board_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    board = _board_for(db, board_id, current_user)
    columns = _columns(db, board)
    _ensure_unique_label(columns, payload.label)
    column = EquipmentColumn(
        board_id=board.id,
        label=payload.label,
        sort_order=max((c.sort_order for c in columns), default=-1) + 1,
    )
    db.add(column)
    _log(db, board=board, action="column_create", name=f"열: {payload.label}", changes={}, user=current_user)
    _commit_label(db, payload.label)
    db.refresh(column)
    return column


@router.put("/columns/order", response_model=list[EquipmentColumnResponse])
def reorder_columns(
    payload: EquipmentColumnOrder,
    board_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    board = _board_for(db, board_id, current_user)
    columns = _columns(db, board)
    by_id = {column.id: column for column in columns}
    if sorted(payload.column_ids) != sorted(by_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="그 사이 열이 추가되거나 지워졌습니다. 새로고침한 뒤 다시 옮겨 주세요.",
        )
    before = [column.label for column in columns]
    for index, column_id in enumerate(payload.column_ids):
        by_id[column_id].sort_order = index
    after = [by_id[column_id].label for column_id in payload.column_ids]
    if before != after:
        _log(
            db,
            board=board,
            action="column_move",
            name="열 순서",
            changes={"순서": [", ".join(before), ", ".join(after)]},
            user=current_user,
        )
    db.commit()
    return [by_id[column_id] for column_id in payload.column_ids]


@router.put("/columns/{column_id}/width", response_model=EquipmentColumnResponse)
def resize_column(
    column_id: int,
    payload: EquipmentColumnWidth,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """B-109: 열 너비. 모두가 같이 보는 값이고, 값이 아니라 모양이라 이력에는 남기지 않는다."""
    column = _column_or_404(db, column_id)
    _board_for(db, column.board_id, current_user)
    column.width = payload.width
    db.commit()
    db.refresh(column)
    return column


@router.put("/columns/{column_id}", response_model=EquipmentColumnResponse)
def rename_column(
    column_id: int,
    payload: EquipmentColumnUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    column = _column_or_404(db, column_id)
    board = _board_for(db, column.board_id, current_user)
    columns = _columns(db, board)
    _ensure_unique_label(columns, payload.label, own_id=column.id)
    if column.label != payload.label:
        _log(
            db,
            board=board,
            action="column_rename",
            name=f"열: {payload.label}",
            changes={"열 이름": [column.label, payload.label]},
            user=current_user,
        )
        column.label = payload.label
        _commit_label(db, payload.label)
        db.refresh(column)
    return column


@router.delete("/columns/{column_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_column(
    column_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    column = _column_or_404(db, column_id)
    board = _board_for(db, column.board_id, current_user)
    columns = _columns(db, board)
    if len(columns) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="마지막 열은 지울 수 없습니다. 새 열을 먼저 추가해 주세요.",
        )
    remaining = [c for c in columns if c.id != column.id]
    key = str(column.id)
    # 지운 열에 있던 값을 장비별로 이력에 남긴다 (다시 입력할 수 있게).
    lost: dict[str, list[str | None]] = {}
    for equipment in db.scalars(select(Equipment).where(Equipment.board_id == board.id)).all():
        values = _values(equipment)
        if key in values:
            lost[f"{_row_name(values, remaining)} (#{equipment.id})"] = [values.pop(key), None]
            equipment.values_json = json.dumps(values, ensure_ascii=False)
    _log(db, board=board, action="column_delete", name=f"열: {column.label}", changes=lost, user=current_user)
    db.delete(column)
    db.commit()


# ── 장비(줄) ─────────────────────────────────────────────────────────


@router.get("", response_model=list[EquipmentResponse])
def list_equipment(
    board_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    board = _board_for(db, board_id, current_user)
    columns = _columns(db, board)
    rows = db.scalars(
        select(Equipment)
        .where(Equipment.board_id == board.id)
        .order_by(Equipment.sort_order, Equipment.id)
    ).all()
    return [_response(row, columns) for row in rows]


def _next_sort_order(db: Session, board: EquipmentBoard) -> int:
    return (
        db.scalar(select(func.max(Equipment.sort_order)).where(Equipment.board_id == board.id)) or 0
    ) + 1


def _create(
    db: Session,
    board: EquipmentBoard,
    payload: EquipmentValues,
    sort_order: int,
    columns: list[EquipmentColumn],
    user: User,
) -> Equipment:
    values = _visible_values(payload, columns)
    if not values:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="한 칸 이상 입력해 주세요.",
        )
    formats = _visible_formats(payload, columns) or {}
    equipment = Equipment(
        board_id=board.id,
        values_json=json.dumps(values, ensure_ascii=False),
        formats_json=json.dumps(formats, ensure_ascii=False) if formats else None,
        sort_order=sort_order,
        version=1,
        updated_by=user.id,
        updated_by_name=user.name,
    )
    db.add(equipment)
    db.flush()
    _log(
        db,
        board=board,
        action="create",
        name=_row_name(values, columns),
        changes=_diff({}, values, columns),
        user=user,
        equipment_id=equipment.id,
    )
    return equipment


@router.post("", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
def create_equipment(
    payload: EquipmentCreate,
    board_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    board = _board_for(db, board_id, current_user)
    columns = _columns(db, board)
    sort_order = payload.sort_order if payload.sort_order is not None else _next_sort_order(db, board)
    equipment = _create(db, board, payload, sort_order, columns, current_user)
    db.commit()
    db.refresh(equipment)
    return _response(equipment, columns)


@router.post("/bulk", response_model=list[EquipmentResponse], status_code=status.HTTP_201_CREATED)
def bulk_create_equipment(
    payload: EquipmentBulkCreate,
    board_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """CSV 가져오기. 기존 줄은 건드리지 않고 맨 아래에 붙인다. 빈 줄은 건너뛴다."""
    board = _board_for(db, board_id, current_user)
    columns = _columns(db, board)
    start = _next_sort_order(db, board)
    created = []
    for row in payload.rows:
        if _visible_values(row, columns):
            created.append(_create(db, board, row, start + len(created), columns, current_user))
    db.commit()
    for equipment in created:
        db.refresh(equipment)
    return [_response(equipment, columns) for equipment in created]


@router.put("/{equipment_id}", response_model=EquipmentResponse)
def update_equipment(
    equipment_id: int,
    payload: EquipmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    equipment = _get_or_404(db, equipment_id)
    board = _board_for(db, equipment.board_id, current_user)
    columns = _columns(db, board)
    if equipment.version != payload.version:
        who = equipment.updated_by_name or "다른 사람"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{who}님이 먼저 이 줄을 고쳤습니다. 되돌리기로 최신 내용을 불러온 뒤 다시 입력해 주세요.",
        )

    before = _values(equipment)
    visible_ids = {str(column.id) for column in columns}
    # 화면에 없는(지운) 열의 값은 그대로 두고, 보이는 열만 바꾼다.
    after = {key: value for key, value in before.items() if key not in visible_ids}
    after.update(_visible_values(payload, columns))
    changes = _diff(before, after, columns)

    before_formats = _formats(equipment)
    next_formats = _visible_formats(payload, columns)
    after_formats = before_formats if next_formats is None else next_formats
    changes.update(_format_diff(before_formats, after_formats, columns))

    if changes:
        equipment.values_json = json.dumps(after, ensure_ascii=False)
        equipment.formats_json = (
            json.dumps(after_formats, ensure_ascii=False) if after_formats else None
        )
        equipment.version += 1
        equipment.updated_by = current_user.id
        equipment.updated_by_name = current_user.name
        _log(
            db,
            board=board,
            action="update",
            name=_row_name(after, columns),
            changes=changes,
            user=current_user,
            equipment_id=equipment.id,
        )
        db.commit()
        db.refresh(equipment)
    return _response(equipment, columns)


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    equipment = _get_or_404(db, equipment_id)
    board = _board_for(db, equipment.board_id, current_user)
    columns = _columns(db, board)
    values = _values(equipment)
    # 지운 내용을 이력에서 다시 볼 수 있게 마지막 값을 모두 남긴다.
    _log(
        db,
        board=board,
        action="delete",
        name=_row_name(values, columns),
        changes=_diff(values, {}, columns),
        user=current_user,
        equipment_id=equipment.id,
    )
    db.delete(equipment)
    db.commit()


@router.post("/bulk-delete", response_model=EquipmentBulkDeleteResult)
def bulk_delete_equipment(
    payload: EquipmentBulkDelete,
    board_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """C-13: 고른 줄을 한꺼번에 지운다. 줄마다 지운 값을 이력에 남긴다."""
    board = _board_for(db, board_id, current_user)
    columns = _columns(db, board)
    ids = list(dict.fromkeys(payload.ids))
    rows = db.scalars(
        select(Equipment).where(Equipment.id.in_(ids), Equipment.board_id == board.id)
    ).all()
    for equipment in rows:
        values = _values(equipment)
        _log(
            db,
            board=board,
            action="delete",
            name=_row_name(values, columns),
            changes=_diff(values, {}, columns),
            user=current_user,
            equipment_id=equipment.id,
        )
        db.delete(equipment)
    db.commit()
    return EquipmentBulkDeleteResult(deleted=len(rows), missing=len(ids) - len(rows))


@router.get("/history", response_model=list[EquipmentHistoryResponse])
def list_equipment_history(
    limit: int = Query(default=100, ge=1, le=500),
    equipment_id: int | None = None,
    board_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    board = _board_for(db, board_id, current_user)
    query = (
        select(EquipmentHistory)
        .where(EquipmentHistory.board_id == board.id)
        .order_by(EquipmentHistory.id.desc())
        .limit(limit)
    )
    if equipment_id is not None:
        query = query.where(EquipmentHistory.equipment_id == equipment_id)
    return [
        EquipmentHistoryResponse(
            id=row.id,
            equipment_id=row.equipment_id,
            equipment_name=row.equipment_name,
            action=row.action,
            changes=row.changes_json,
            user_name=row.user_name,
            created_at=row.created_at,
        )
        for row in db.scalars(query).all()
    ]
