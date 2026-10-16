"""
장비 현황표 API.

관리자·일반 구분 없이 로그인한 사람은 모두 보고, 추가·수정·삭제할 수 있다.
대신 모든 변경을 equipment_history 에 남기고,
두 사람이 같은 줄을 동시에 고치면 나중 저장을 막아 덮어쓰기를 피한다.
"""
import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.equipment import EQUIPMENT_FIELDS, Equipment, EquipmentHistory
from app.models.user import User
from app.schemas.equipment import (
    EquipmentBulkCreate,
    EquipmentCreate,
    EquipmentFields,
    EquipmentHistoryResponse,
    EquipmentResponse,
    EquipmentUpdate,
)

router = APIRouter(prefix="/equipment", tags=["equipment"])


def _get_or_404(db: Session, equipment_id: int) -> Equipment:
    equipment = db.get(Equipment, equipment_id)
    if equipment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="장비를 찾을 수 없습니다. 다른 사람이 삭제했을 수 있습니다. 새로고침해 주세요.",
        )
    return equipment


def _next_sort_order(db: Session) -> int:
    return (db.scalar(select(func.max(Equipment.sort_order))) or 0) + 1


def _log(
    db: Session,
    equipment: Equipment,
    action: str,
    changes: dict[str, list[str | None]],
    user: User,
) -> None:
    db.add(
        EquipmentHistory(
            equipment_id=equipment.id,
            equipment_name=equipment.name,
            action=action,
            changes_json=json.dumps(changes, ensure_ascii=False),
            user_id=user.id,
            user_name=user.name,
        )
    )


def _create(db: Session, fields: EquipmentFields, sort_order: int, user: User) -> Equipment:
    equipment = Equipment(
        **fields.model_dump(include=set(EQUIPMENT_FIELDS)),
        sort_order=sort_order,
        version=1,
        updated_by=user.id,
        updated_by_name=user.name,
    )
    db.add(equipment)
    db.flush()
    changes = {
        field: [None, getattr(equipment, field)]
        for field in EQUIPMENT_FIELDS
        if getattr(equipment, field) is not None
    }
    _log(db, equipment, "create", changes, user)
    return equipment


@router.get("", response_model=list[EquipmentResponse])
def list_equipment(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.scalars(
        select(Equipment).order_by(Equipment.sort_order.asc(), Equipment.id.asc())
    ).all()


@router.post("", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
def create_equipment(
    payload: EquipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sort_order = payload.sort_order if payload.sort_order is not None else _next_sort_order(db)
    equipment = _create(db, payload, sort_order, current_user)
    db.commit()
    db.refresh(equipment)
    return equipment


@router.post("/bulk", response_model=list[EquipmentResponse], status_code=status.HTTP_201_CREATED)
def bulk_create_equipment(
    payload: EquipmentBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """CSV 가져오기. 기존 줄은 건드리지 않고 맨 아래에 붙인다."""
    start = _next_sort_order(db)
    created = [
        _create(db, row, start + index, current_user)
        for index, row in enumerate(payload.rows)
    ]
    db.commit()
    for equipment in created:
        db.refresh(equipment)
    return created


@router.put("/{equipment_id}", response_model=EquipmentResponse)
def update_equipment(
    equipment_id: int,
    payload: EquipmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    equipment = _get_or_404(db, equipment_id)
    if equipment.version != payload.version:
        who = equipment.updated_by_name or "다른 사람"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{who}님이 먼저 이 줄을 고쳤습니다. 새로고침한 뒤 다시 입력해 주세요.",
        )

    changes: dict[str, list[str | None]] = {}
    for field in EQUIPMENT_FIELDS:
        before = getattr(equipment, field)
        after = getattr(payload, field)
        if before != after:
            changes[field] = [before, after]
            setattr(equipment, field, after)

    if changes:
        equipment.version += 1
        equipment.updated_by = current_user.id
        equipment.updated_by_name = current_user.name
        _log(db, equipment, "update", changes, current_user)
        db.commit()
        db.refresh(equipment)
    return equipment


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    equipment = _get_or_404(db, equipment_id)
    # 지운 내용을 이력에서 다시 볼 수 있게 마지막 값을 모두 남긴다.
    changes = {
        field: [getattr(equipment, field), None]
        for field in EQUIPMENT_FIELDS
        if getattr(equipment, field) is not None
    }
    _log(db, equipment, "delete", changes, current_user)
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
