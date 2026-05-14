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
    table_names = inspector.get_table_names()
    if "projects" not in table_names:
        return

    statements: list[str] = []

    subproject_columns = {
        column["name"] for column in inspector.get_columns("subprojects")
    }
    if "custom_fields" not in subproject_columns:
        statements.append("ALTER TABLE subprojects ADD COLUMN custom_fields TEXT")

    if "projects" in table_names:
        project_columns = {
            column["name"] for column in inspector.get_columns("projects")
        }
        if "major_project_id" not in project_columns:
            statements.append(
                "ALTER TABLE projects ADD COLUMN major_project_id INTEGER REFERENCES major_projects(id) ON DELETE RESTRICT"
            )
        if "start_date" not in project_columns:
            statements.append("ALTER TABLE projects ADD COLUMN start_date DATE")
        if "end_date" not in project_columns:
            statements.append("ALTER TABLE projects ADD COLUMN end_date DATE")

    if "project_execution_history" in table_names:
        history_columns = {
            column["name"]
            for column in inspector.get_columns("project_execution_history")
        }
        if "manual_override" not in history_columns:
            # Postgres/SQLite 모두에서 동작하는 형태(FALSE 키워드는 양쪽 지원).
            # Postgres는 아래에서 'IF NOT EXISTS'로 치환된다.
            statements.append(
                "ALTER TABLE project_execution_history "
                "ADD COLUMN manual_override BOOLEAN NOT NULL DEFAULT FALSE"
            )
        if engine.dialect.name == "postgresql":
            statements.extend(
                [
                    "ALTER TABLE project_execution_history ALTER COLUMN project_id DROP NOT NULL",
                    "ALTER TABLE project_execution_history ALTER COLUMN subproject_id DROP NOT NULL",
                ]
            )

    if "progress_logs" in table_names:
        progress_log_columns = {
            column["name"] for column in inspector.get_columns("progress_logs")
        }
        if "subproject_id" not in progress_log_columns:
            statements.append(
                "ALTER TABLE progress_logs ADD COLUMN subproject_id INTEGER REFERENCES subprojects(id) ON DELETE CASCADE"
            )

    if not statements:
        statements = []

    if engine.dialect.name == "postgresql":
        statements = [
            statement.replace("ADD COLUMN ", "ADD COLUMN IF NOT EXISTS ")
            for statement in statements
        ]

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        if "major_projects" in inspect(engine).get_table_names():
            connection.execute(
                text(
                    """
                    INSERT INTO major_projects (name, is_default)
                    SELECT '미분류/기본 대프로젝트', TRUE
                    WHERE NOT EXISTS (
                        SELECT 1 FROM major_projects WHERE is_default = TRUE
                    )
                    """
                )
            )
            connection.execute(
                text(
                    """
                    INSERT INTO major_project_members (major_project_id, user_id)
                    SELECT mp.id, u.id
                    FROM major_projects mp
                    CROSS JOIN users u
                    WHERE mp.is_default = TRUE
                      AND u.is_active = TRUE
                      AND NOT EXISTS (
                        SELECT 1
                        FROM major_project_members mpm
                        WHERE mpm.major_project_id = mp.id
                          AND mpm.user_id = u.id
                      )
                    """
                )
            )
            connection.execute(
                text(
                    """
                    UPDATE projects
                    SET major_project_id = (
                        SELECT id FROM major_projects WHERE is_default = TRUE LIMIT 1
                    )
                    WHERE major_project_id IS NULL
                    """
                )
            )
        if "subproject_assignees" in inspect(engine).get_table_names():
            connection.execute(
                text(
                    """
                    INSERT INTO subproject_assignees (subproject_id, user_id)
                    SELECT sp.id, sp.assignee_id
                    FROM subprojects sp
                    WHERE sp.assignee_id IS NOT NULL
                      AND NOT EXISTS (
                        SELECT 1
                        FROM subproject_assignees sa
                        WHERE sa.subproject_id = sp.id
                          AND sa.user_id = sp.assignee_id
                      )
                    """
                )
            )


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
