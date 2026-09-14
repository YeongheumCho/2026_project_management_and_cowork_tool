"""
?꾨줈?앺듃/?뚰봽濡쒖젥???몃? ?쒖뒪??REST API.

?붾뱶?ъ씤???붿빟
  # Projects
  POST   /projects                     愿由ъ옄: 理쒖긽???꾨줈?앺듃 ?앹꽦
  GET    /projects                     ?꾩껜 ?ъ슜?? ?꾨줈?앺듃 紐⑸줉
  # SubProjects
  POST   /subprojects                  愿由ъ옄: ?뚰봽濡쒖젥???앹꽦 (?꾨줈?앺듃 ?좏삎???곕씪 ?몃? ?쒖뒪???먮룞 ?앹꽦)
  GET    /subprojects                  荑쇰━: ?project_id, ?assignee_id
  GET    /subprojects/{id}             ?④굔 議고쉶
  PUT    /subprojects/{id}             愿由ъ옄: KEFICO ?꾨뱶 ?ы븿 遺遺??섏젙
  DELETE /subprojects/{id}             愿由ъ옄: 誘몄셿猷??곹깭?먯꽌留???젣
  # SubTasks
  PATCH  /subtasks/{id}                泥댄겕/?댁젣 ???대떦??蹂몄씤 ?먮뒗 愿由ъ옄
"""
from fastapi import APIRouter

from app.routers.projects import (
    history,
    major_projects,
    progress_logs,
    projects,
    subprojects,
    subtasks,
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

__all__ = ["router"]
