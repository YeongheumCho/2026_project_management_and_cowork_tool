"""
프로젝트/소프로젝트/세부 태스크 REST API.

엔드포인트 요약
  # Projects
  POST   /projects                     관리자: 최상위 프로젝트 생성
  GET    /projects                     전체 사용자: 프로젝트 목록
  # SubProjects
  POST   /subprojects                  관리자: 소프로젝트 생성 (프로젝트 유형에 따라 세부 태스크 자동 생성)
  GET    /subprojects                  쿼리: ?project_id, ?assignee_id
  GET    /subprojects/{id}             단건 조회
  PUT    /subprojects/{id}             관리자: KEFICO 필드 포함 부분 수정
  DELETE /subprojects/{id}             관리자: 미완료 상태에서만 삭제
  # SubTasks
  PATCH  /subtasks/{id}                체크/해제 — 담당자 본인 또는 관리자
"""
from fastapi import APIRouter

from app.routers.projects import (
    history,
    major_projects,
    progress_logs,
    projects,
    subprojects,
    subtasks,
    time_entries,
)


# include_router 순서는 분리 전 단일 파일의 라우트 등록 순서와 동일하게 유지합니다.
# 부모 라우터에는 tags를 주지 않습니다. 하위 라우터와 중복되면 OpenAPI 태그가 두 번 붙습니다.
router = APIRouter()

router.include_router(major_projects.router)
router.include_router(projects.router)
router.include_router(subprojects.router)
router.include_router(subtasks.router)
router.include_router(history.router)
router.include_router(progress_logs.router)
router.include_router(time_entries.router)

__all__ = ["router"]
