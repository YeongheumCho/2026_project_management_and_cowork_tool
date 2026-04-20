from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    idnum: str = Field(max_length=9)
    name: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default="member", pattern="^(admin|member)$")


class UserResponse(BaseModel):
    id: int
    idnum: str
    name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserRoleUpdate(BaseModel):
    role: str = Field(pattern="^(admin|member)$")


class UserBrief(BaseModel):
    id: int
    name: str
    role: str

    model_config = ConfigDict(from_attributes=True)
