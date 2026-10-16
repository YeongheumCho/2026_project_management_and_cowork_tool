from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.dependencies import INACTIVE_ACCOUNT_DETAIL, get_current_user, get_db, require_admin
from app.models.progress_log import ProgressLog
from app.models.time_entry import SubProjectTimeEntry
from app.models.user import User
from app.models.workflow import ProjectExecutionHistory, WorkLog
from app.schemas.auth import TokenResponse
from app.schemas.user import (
    UserActiveUpdate,
    UserCreate,
    UserPasswordReset,
    UserProfileUpdate,
    UserResponse,
    UserRoleUpdate,
    UserSyncChange,
    UserSyncRequest,
    UserSyncResult,
)


router = APIRouter(prefix="/auth", tags=["auth"])


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

    # 퇴사(비활성) 처리된 계정은 로그인하지 못한다.
    # 비밀번호가 맞을 때만 알려 주어, 비밀번호 없이 계정 상태를 알아낼 수 없게 한다.
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=INACTIVE_ACCOUNT_DETAIL,
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


@router.patch("/users/{idnum}", response_model=UserResponse)
def update_user_profile(
    idnum: str,
    payload: UserProfileUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    target_user = db.scalar(select(User).where(User.idnum == idnum))
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )

    for key, value in payload.model_dump(exclude_unset=True).items():
        normalized = value.strip() if isinstance(value, str) else value
        setattr(target_user, key, normalized or None)
    db.commit()
    db.refresh(target_user)
    return target_user


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


@router.patch("/users/{idnum}/active", response_model=UserResponse)
def update_user_active(
    idnum: str,
    payload: UserActiveUpdate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """재직/퇴사 상태를 직접 바꾼다.

    퇴사 처리는 보통 조직도 동기화가 하지만, 그룹웨어 조직도에 없는 인원(인턴 등)이
    잘못 비활성화되면 관리자가 되돌릴 방법이 없었다. 비활성 인원은 프로젝트에 넣을 수 없다.
    다음 조직도 동기화 때 그룹웨어에 없으면 다시 비활성으로 바뀐다.
    """
    target_user = db.scalar(select(User).where(User.idnum == idnum))
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )

    if current_admin.idnum == target_user.idnum and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신은 퇴사 처리할 수 없습니다.",
        )

    target_user.is_active = payload.is_active
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

    # 계정을 지우면 그 사람의 진행률 기록·스톱워치 기록·수행 이력·검증 시간이 함께 지워지고
    # 하위 프로젝트 진행률 계산에서도 빠진다. 퇴사자는 '퇴사 처리'로 기록을 남긴다.
    record_counts = [
        db.scalar(select(func.count()).select_from(model).where(model.user_id == target_user.id)) or 0
        for model in (WorkLog, ProgressLog, ProjectExecutionHistory, SubProjectTimeEntry)
    ]
    if any(record_counts):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"{target_user.name}님은 업무 기록(진행률·스톱워치·수행 이력·검증 시간)이 있어 삭제할 수 없습니다. "
                "기록을 남긴 채 쓰지 못하게 하려면 '퇴사 처리'를 해 주세요."
            ),
        )

    db.delete(target_user)
    db.commit()
    return None


# 신규 계정 초기 비밀번호 — 기존 사용자 추가 화면과 같은 규칙
_SYNC_DEFAULT_PASSWORD = "12345678"

# 이 값들만 그룹웨어 기준으로 덮어쓴다. 권한과 비밀번호는 절대 건드리지 않는다.
_SYNC_FIELDS = ("name", "center", "office", "team", "position", "email", "phone")


def _normalize_idnum(value: str) -> str:
    """사번을 9자리로 맞춘다. DB에 앞자리 0이 빠져 저장된 값이 있어 보정이 필요하다."""
    return (value or "").strip().zfill(9)


@router.post("/users/sync", response_model=UserSyncResult)
def sync_users(
    payload: UserSyncRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """그룹웨어 조직도 목록으로 사용자 정보를 맞춘다.

    - 사번이 키. 없으면 새로 만들고, 있으면 소속·직급·연락처를 갱신한다.
    - 목록에 없는 사람은 지우지 않고 비활성으로 돌린다. 지우면 그 사람 이름으로
      남은 프로젝트와 수행 이력의 담당자가 비기 때문이다. 관리자 계정도 같다.
    - 권한(admin/member)과 비밀번호는 어떤 경우에도 바꾸지 않는다.
    - 단 하나의 예외로, 동기화를 실행한 본인 계정은 끄지 않는다.
      작업 도중 스스로 로그아웃되어 되돌릴 수 없게 되는 것을 막기 위해서다.
    """
    result = UserSyncResult(dry_run=payload.dry_run, total_rows=len(payload.rows))

    seen: set[str] = set()
    for row in payload.rows:
        idnum = _normalize_idnum(row.idnum)
        if idnum in seen:
            result.errors.append(f"사번 {idnum} 이 목록에 두 번 있습니다. 뒤의 줄은 건너뜁니다.")
            continue
        seen.add(idnum)

    existing = {
        _normalize_idnum(user.idnum): user
        for user in db.scalars(select(User)).all()
    }

    for row in payload.rows:
        idnum = _normalize_idnum(row.idnum)
        user = existing.get(idnum)

        if user is None:
            if not payload.dry_run:
                user = User(
                    idnum=idnum,
                    name=row.name,
                    password_hash=hash_password(_SYNC_DEFAULT_PASSWORD),
                    role="member",
                    is_active=True,
                )
                for field in _SYNC_FIELDS:
                    setattr(user, field, getattr(row, field))
                db.add(user)
            result.created.append(
                UserSyncChange(
                    idnum=idnum,
                    name=row.name,
                    detail=f"{row.team or row.office or row.center or '소속 미지정'} · {row.position or '직급 미지정'}",
                )
            )
            continue

        # DB 사번에 앞자리 0 이 빠져 있으면 이번 기회에 맞춘다.
        if user.idnum != idnum:
            result.idnum_fixed.append(
                UserSyncChange(idnum=idnum, name=user.name, detail=f"{user.idnum} → {idnum}")
            )
            if not payload.dry_run:
                user.idnum = idnum

        diffs = []
        for field in _SYNC_FIELDS:
            new_value = getattr(row, field)
            if (getattr(user, field) or "") != (new_value or ""):
                diffs.append(f"{field} {getattr(user, field) or '없음'} → {new_value or '없음'}")
                if not payload.dry_run:
                    setattr(user, field, new_value)

        if not user.is_active:
            result.reactivated.append(UserSyncChange(idnum=idnum, name=row.name))
            if not payload.dry_run:
                user.is_active = True
        elif diffs:
            result.updated.append(
                UserSyncChange(idnum=idnum, name=row.name, detail=", ".join(diffs))
            )
        else:
            result.unchanged += 1

    if payload.deactivate_missing:
        for idnum, user in existing.items():
            if idnum in seen or not user.is_active:
                continue
            if user.id == current_admin.id:
                # 실행한 본인만 예외. 스스로 로그아웃되면 되돌릴 수 없다.
                result.admin_skipped.append(
                    UserSyncChange(
                        idnum=idnum,
                        name=user.name,
                        detail="동기화를 실행한 본인 계정이라 건너뛰었습니다. 필요하면 다른 관리자가 처리하세요.",
                    )
                )
                continue
            if payload.limit_center and (user.center or "") != payload.limit_center:
                continue
            result.deactivated.append(
                UserSyncChange(
                    idnum=idnum,
                    name=user.name,
                    detail=f"{user.team or user.office or user.center or '소속 미지정'} · {user.position or ''}",
                )
            )
            if not payload.dry_run:
                user.is_active = False

    if payload.dry_run:
        db.rollback()
    else:
        db.commit()
    return result
