from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserCreate(BaseModel):
    idnum: str = Field(max_length=9)
    name: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    idnum: str
    name: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)