from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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
