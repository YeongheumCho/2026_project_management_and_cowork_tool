from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import project, progress_log, user
from app.routers.project import router as project_router


from app.core.config import settings
from app.db import engine
from app.models.base import Base
from app.models import user
from app.routers.auth import router as auth_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="KPI Collaboration Tool API")



app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(project_router)

@app.get("/")
def root():
    return {"message": "Backend is running"}

