from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ProgressLogCreate(BaseModel):
    progress_percent: int = Field(ge=0, le=100)
    comment: str | None = None
    work_date: date


class ProgressLogResponse(BaseModel):
    id: int
    project_id: int
    user_id: int
    progress_percent: int
    comment: str | None
    work_date: date
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)