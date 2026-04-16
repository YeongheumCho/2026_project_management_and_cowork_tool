from fastapi import APIRouter, HTTPException

from app.schemas.chat import ChatRequest, ChatResponse, HealthResponse
from app.services.llm import llm_service
from app.core.config import settings

router = APIRouter()


@router.post("/", response_model=ChatResponse, summary="Claude에 메시지 전송")
async def send_chat(request: ChatRequest) -> ChatResponse:
    """
    대화 히스토리를 전송하면 Claude가 다음 응답을 생성합니다.

    - **messages**: user/assistant 역할의 메시지 배열
    - **system_prompt**: (선택) 커스텀 시스템 프롬프트
    """
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY가 설정되지 않았습니다.",
        )

    try:
        return await llm_service.chat(
            messages=request.messages,
            system_prompt=request.system_prompt,
            user_email=request.user_email,
        )
    except Exception as e:
        error_msg = str(e)
        if "401" in error_msg or "authentication" in error_msg.lower():
            raise HTTPException(status_code=401, detail="API 키가 유효하지 않습니다.")
        if "429" in error_msg or "rate" in error_msg.lower():
            raise HTTPException(
                status_code=429,
                detail="요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
            )
        raise HTTPException(status_code=500, detail="AI 응답 생성 중 오류가 발생했습니다.")


@router.get("/health", response_model=HealthResponse, summary="헬스체크")
async def health_check() -> HealthResponse:
    """서버 상태 및 API 키 설정 여부를 확인합니다."""
    return HealthResponse(
        status="ok",
        api_key_configured=bool(settings.ANTHROPIC_API_KEY),
        model=settings.CLAUDE_MODEL,
    )
