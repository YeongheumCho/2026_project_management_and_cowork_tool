from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.user import UserCreate, UserPasswordReset, UserResponse, UserRoleUpdate


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.scalar(select(User).where(User.idnum == payload.idnum))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 사용 중인 사번입니다.",
        )

    user = User(
        idnum=payload.idnum,
        name=payload.name,
        password_hash=hash_password(payload.password),
        role=payload.role,
        center=payload.center,
        office=payload.office,
        team=payload.team,
        position=payload.position,
        email=payload.email,
        phone=payload.phone,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.idnum == form_data.username))

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사번 또는 비밀번호가 올바르지 않습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(subject=user.idnum)
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/users", response_model=list[UserResponse])
def list_users(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.scalars(select(User).order_by(User.name.asc(), User.idnum.asc())).all()


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing_user = db.scalar(select(User).where(User.idnum == payload.idnum))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 사용 중인 사번입니다.",
        )

    user = User(
        idnum=payload.idnum,
        name=payload.name,
        password_hash=hash_password(payload.password),
        role=payload.role,
        center=payload.center,
        office=payload.office,
        team=payload.team,
        position=payload.position,
        email=payload.email,
        phone=payload.phone,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{idnum}/role", response_model=UserResponse)
def update_user_role(
    idnum: str,
    payload: UserRoleUpdate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    target_user = db.scalar(select(User).where(User.idnum == idnum))
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )

    if current_admin.idnum == target_user.idnum and payload.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신의 관리자 권한은 해제할 수 없습니다.",
        )

    target_user.role = payload.role
    db.commit()
    db.refresh(target_user)
    return target_user


@router.patch("/users/{idnum}/password", status_code=status.HTTP_204_NO_CONTENT)
def reset_user_password(
    idnum: str,
    payload: UserPasswordReset,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    target_user = db.scalar(select(User).where(User.idnum == idnum))
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )

    target_user.password_hash = hash_password(payload.password)
    db.commit()
    return None


@router.delete("/users/{idnum}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    idnum: str,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    target_user = db.scalar(select(User).where(User.idnum == idnum))
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )

    if current_admin.idnum == target_user.idnum:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신은 삭제할 수 없습니다.",
        )

    admin_count = db.scalar(select(func.count()).select_from(User).where(User.role == "admin")) or 0
    if target_user.role == "admin" and admin_count <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="마지막 관리자 계정은 삭제할 수 없습니다.",
        )

    db.delete(target_user)
    db.commit()
    return None
