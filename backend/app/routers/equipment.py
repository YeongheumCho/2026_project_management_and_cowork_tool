"""
장비 현황표 API.

관리자·일반 구분 없이 로그인한 사람은 모두 보고, 줄과 열(항목)을 추가·수정·삭제할 수 있다.
대신 모든 변경을 equipment_history 에 남기고,
두 사람이 같은 줄을 동시에 고치면 나중 저장을 막아 덮어쓰기를 피한다.
"""
import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.equipment import (
    DEFAULT_EQUIPMENT_COLUMNS,
    Equipment,
    EquipmentColumn,
    EquipmentHistory,
)
from app.models.user import User
from app.schemas.equipment import (
    EquipmentBulkCreate,
    EquipmentColumnCreate,
    EquipmentColumnOrder,
    EquipmentColumnResponse,
    EquipmentColumnUpdate,
    EquipmentCreate,
    EquipmentHistoryResponse,
    EquipmentResponse,
    EquipmentUpdate,
    EquipmentValues,
)

router = APIRouter(prefix="/equipment", tags=["equipment"])

UNNAMED = "(이름 없음)"


# ── 공통 ───────────────────────────────────────────────────────────


def _load_columns(db: Session) -> list[EquipmentColumn]:
    return list(
        db.scalars(
            select(EquipmentColumn).order_by(EquipmentColumn.sort_order, EquipmentColumn.id)
        ).all()
    )


def _columns(db: Session) -> list[EquipmentColumn]:
    columns = _load_columns(db)
    if columns:
        return columns
    # 처음 쓰는 표: 시트16 열로 시작한다. 마지막 열은 지울 수 없으므로 다시 비지 않는다.
    # 화면은 열과 줄을 동시에 읽으므로 두 요청이 함께 여기 올 수 있다.
    # 열 이름이 고유라서 늦은 쪽은 실패하고, 먼저 만든 열을 다시 읽는다.
    db.add_all(
        EquipmentColumn(label=label, sort_order=index)
        for index, label in enumerate(DEFAULT_EQUIPMENT_COLUMNS)
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return _load_columns(db)


def _values(equipment: Equipment) -> dict[str, str]:
    try:
        data = json.loads(equipment.values_json or "{}")
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


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
    action: str,
    name: str,
    changes: dict[str, list[str | None]],
    user: User,
    equipment_id: int | None = None,
) -> None:
    db.add(
        EquipmentHistory(
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


def _diff(
    before: dict[str, str], after: dict[str, str], columns: list[EquipmentColumn]
) -> dict[str, list[str | None]]:
    return {
        column.label: [before.get(str(column.id)), after.get(str(column.id))]
        for column in columns
        if before.get(str(column.id)) != after.get(str(column.id))
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
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return _columns(db)


@router.post("/columns", response_model=EquipmentColumnResponse, status_code=status.HTTP_201_CREATED)
def create_column(
    payload: EquipmentColumnCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    columns = _columns(db)
    _ensure_unique_label(columns, payload.label)
    column = EquipmentColumn(
        label=payload.label,
        sort_order=max((c.sort_order for c in columns), default=-1) + 1,
    )
    db.add(column)
    _log(db, action="column_create", name=f"열: {payload.label}", changes={}, user=current_user)
    _commit_label(db, payload.label)
    db.refresh(column)
    return column


@router.put("/columns/order", response_model=list[EquipmentColumnResponse])
def reorder_columns(
    payload: EquipmentColumnOrder,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    columns = _columns(db)
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
            action="column_move",
            name="열 순서",
            changes={"순서": [", ".join(before), ", ".join(after)]},
            user=current_user,
        )
    db.commit()
    return [by_id[column_id] for column_id in payload.column_ids]


@router.put("/columns/{column_id}", response_model=EquipmentColumnResponse)
def rename_column(
    column_id: int,
    payload: EquipmentColumnUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    columns = _columns(db)
    column = _column_or_404(db, column_id)
    _ensure_unique_label(columns, payload.label, own_id=column.id)
    if column.label != payload.label:
        _log(
            db,
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
    columns = _columns(db)
    column = _column_or_404(db, column_id)
    if len(columns) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="마지막 열은 지울 수 없습니다. 새 열을 먼저 추가해 주세요.",
        )
    remaining = [c for c in columns if c.id != column.id]
    key = str(column.id)
    # 지운 열에 있던 값을 장비별로 이력에 남긴다 (다시 입력할 수 있게).
    lost: dict[str, list[str | None]] = {}
    for equipment in db.scalars(select(Equipment)).all():
        values = _values(equipment)
        if key in values:
            lost[f"{_row_name(values, remaining)} (#{equipment.id})"] = [values.pop(key), None]
            equipment.values_json = json.dumps(values, ensure_ascii=False)
    _log(db, action="column_delete", name=f"열: {column.label}", changes=lost, user=current_user)
    db.delete(column)
    db.commit()


# ── 장비(줄) ─────────────────────────────────────────────────────────


@router.get("", response_model=list[EquipmentResponse])
def list_equipment(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    columns = _columns(db)
    rows = db.scalars(select(Equipment).order_by(Equipment.sort_order, Equipment.id)).all()
    return [_response(row, columns) for row in rows]


def _next_sort_order(db: Session) -> int:
    return (db.scalar(select(func.max(Equipment.sort_order))) or 0) + 1


def _create(
    db: Session,
    values: dict[str, str],
    sort_order: int,
    columns: list[EquipmentColumn],
    user: User,
) -> Equipment:
    if not values:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="한 칸 이상 입력해 주세요.",
        )
    equipment = Equipment(
        values_json=json.dumps(values, ensure_ascii=False),
        sort_order=sort_order,
        version=1,
        updated_by=user.id,
        updated_by_name=user.name,
    )
    db.add(equipment)
    db.flush()
    _log(
        db,
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    columns = _columns(db)
    sort_order = payload.sort_order if payload.sort_order is not None else _next_sort_order(db)
    equipment = _create(db, _visible_values(payload, columns), sort_order, columns, current_user)
    db.commit()
    db.refresh(equipment)
    return _response(equipment, columns)


@router.post("/bulk", response_model=list[EquipmentResponse], status_code=status.HTTP_201_CREATED)
def bulk_create_equipment(
    payload: EquipmentBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """CSV 가져오기. 기존 줄은 건드리지 않고 맨 아래에 붙인다. 빈 줄은 건너뛴다."""
    columns = _columns(db)
    start = _next_sort_order(db)
    created = []
    for row in payload.rows:
        values = _visible_values(row, columns)
        if values:
            created.append(_create(db, values, start + len(created), columns, current_user))
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
    columns = _columns(db)
    equipment = _get_or_404(db, equipment_id)
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
    if changes:
        equipment.values_json = json.dumps(after, ensure_ascii=False)
        equipment.version += 1
        equipment.updated_by = current_user.id
        equipment.updated_by_name = current_user.name
        _log(
            db,
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
    columns = _columns(db)
    equipment = _get_or_404(db, equipment_id)
    values = _values(equipment)
    # 지운 내용을 이력에서 다시 볼 수 있게 마지막 값을 모두 남긴다.
    _log(
        db,
        action="delete",
        name=_row_name(values, columns),
        changes=_diff(values, {}, columns),
        user=current_user,
        equipment_id=equipment.id,
    )
    db.delete(equipment)
    db.commit()


@router.get("/history", response_model=list[EquipmentHistoryResponse])
def list_equipment_history(
    limit: int = Query(default=100, ge=1, le=500),
    equipment_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(EquipmentHistory).order_by(EquipmentHistory.id.desc()).limit(limit)
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
