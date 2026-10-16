from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserCreate(BaseModel):
    idnum: str = Field(max_length=9)
    name: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default="member", pattern="^(admin|member)$")
    center: str | None = Field(default=None, max_length=100)
    office: str | None = Field(default=None, max_length=100)
    team: str | None = Field(default=None, max_length=100)
    position: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=20)

    @field_validator("idnum", mode="before")
    @classmethod
    def _normalize_idnum(cls, value):
        # 사번은 숫자 9자리다 (그룹웨어·인원 동기화와 같은 규칙). 예전에는 "abc" 도 만들어졌다.
        text = str(value or "").strip()
        if not text.isdigit():
            raise ValueError("사번은 숫자로 입력해 주세요.")
        return text.zfill(9)


class UserResponse(BaseModel):
    id: int
    idnum: str
    name: str
    role: str
    is_active: bool
    center: str | None = None
    office: str | None = None
    team: str | None = None
    position: str | None = None
    email: str | None = None
    phone: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserRoleUpdate(BaseModel):
    role: str = Field(pattern="^(admin|member)$")


class UserActiveUpdate(BaseModel):
    is_active: bool


class UserPasswordReset(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class UserProfileUpdate(BaseModel):
    center: str | None = Field(default=None, max_length=100)
    office: str | None = Field(default=None, max_length=100)
    team: str | None = Field(default=None, max_length=100)
    position: str | None = Field(default=None, max_length=50)


class UserBrief(BaseModel):
    id: int
    idnum: str
    name: str
    role: str
    center: str | None = None
    office: str | None = None
    team: str | None = None
    position: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UserSyncRow(BaseModel):
    """그룹웨어 조직도 한 줄. 사번이 키다."""

    idnum: str = Field(min_length=1, max_length=9)
    name: str = Field(min_length=1, max_length=50)
    center: str | None = Field(default=None, max_length=100)
    office: str | None = Field(default=None, max_length=100)
    team: str | None = Field(default=None, max_length=100)
    position: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=20)


class UserSyncRequest(BaseModel):
    rows: list[UserSyncRow]
    # 목록에 없는 사람을 비활성으로 돌릴지. 계정과 이력은 지우지 않는다.
    deactivate_missing: bool = True
    # 참일 때는 무엇이 바뀌는지만 계산하고 저장하지 않는다.
    dry_run: bool = False
    # 비활성 처리 대상을 이 소속으로 한정한다. 비우면 전체가 대상.
    limit_center: str | None = Field(default=None, max_length=100)


class UserSyncChange(BaseModel):
    idnum: str
    name: str
    detail: str = ""


class UserSyncResult(BaseModel):
    dry_run: bool
    total_rows: int
    created: list[UserSyncChange] = []
    updated: list[UserSyncChange] = []
    deactivated: list[UserSyncChange] = []
    reactivated: list[UserSyncChange] = []
    idnum_fixed: list[UserSyncChange] = []
    # 목록에 없지만 동기화를 실행한 본인이라 비활성에서 제외한 계정
    admin_skipped: list[UserSyncChange] = []
    unchanged: int = 0
    errors: list[str] = []
