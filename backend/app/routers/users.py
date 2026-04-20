"""
사용자 조회 라우터.

- GET /users  : 팀원 선택(담당자 드롭다운)용 목록. 로그인된 사용자 전원.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.user import UserBrief


router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserBrief])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.scalars(
        select(User).where(User.is_active.is_(True)).order_by(User.name.asc())
    ).all()
