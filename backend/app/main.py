from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db import engine

# models 패키지 import 시 User / Project / SubProject / SubTask 가 모두 등록된다.
from app.models import Base  # noqa: F401
from app.routers.auth import router as auth_router
from app.routers.projects import router as projects_router
from app.routers.users import router as users_router
from app.routers.workflow import router as workflow_router

Base.metadata.create_all(bind=engine)

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
app.include_router(workflow_router)

@app.get("/")
def root():
    return {"message": "Backend is running"}

