"""Shared FastAPI dependencies."""

from typing import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db import SessionLocal
from app.models.user import User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

INACTIVE_ACCOUNT_DETAIL = "퇴사(비활성) 처리된 계정이라 사용할 수 없습니다. 관리자에게 문의해 주세요."


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        # 8시간이 지나 만료되었거나 서버 키가 바뀐 경우. 화면에 그대로 보이므로 한국어로 둔다.
        detail="로그인이 만료되었습니다. 다시 로그인해 주세요.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        userid = payload.get("sub")
        if userid is None:
            raise credentials_exc
    except JWTError as exc:
        raise credentials_exc from exc

    user = db.scalar(select(User).where(User.idnum == userid))
    if not user:
        # 계정이 삭제된 경우. 401 이어야 화면이 토큰을 지우고 로그인 화면으로 보낸다.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="계정을 찾을 수 없습니다. 다시 로그인해 주세요.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # 로그인한 뒤 퇴사(비활성) 처리되면 남은 토큰으로도 쓰지 못하게 한다.
    # 401 이면 화면이 토큰을 지우고 로그인 화면으로 보낸다.
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=INACTIVE_ACCOUNT_DETAIL,
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자만 사용할 수 있습니다.",
        )
    return current_user
