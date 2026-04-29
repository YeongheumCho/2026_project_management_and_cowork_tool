from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.core.config import settings
from app.db import engine

# models 패키지 import 시 User / Project / SubProject / SubTask 가 모두 등록된다.
from app.models import Base  # noqa: F401
from app.routers.auth import router as auth_router
from app.routers.field_schemas import router as field_schemas_router
from app.routers.projects import router as projects_router
from app.routers.templates import router as templates_router
from app.routers.users import router as users_router
from app.routers.workflow import router as workflow_router

Base.metadata.create_all(bind=engine)


def _ensure_additive_schema_updates() -> None:
    """Apply tiny additive updates that create_all cannot add to existing tables."""
    inspector = inspect(engine)
    if "subprojects" not in inspector.get_table_names():
        return

    subproject_columns = {
        column["name"] for column in inspector.get_columns("subprojects")
    }
    if "custom_fields" in subproject_columns:
        return

    statement = "ALTER TABLE subprojects ADD COLUMN custom_fields TEXT"
    if engine.dialect.name == "postgresql":
        statement = "ALTER TABLE subprojects ADD COLUMN IF NOT EXISTS custom_fields TEXT"

    with engine.begin() as connection:
        connection.execute(text(statement))


_ensure_additive_schema_updates()

app = FastAPI(title="KPI Collaboration Tool API")



app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(projects_router)
app.include_router(templates_router)
app.include_router(field_schemas_router)
app.include_router(workflow_router)

@app.get("/")
def root():
    return {"message": "Backend is running"}

