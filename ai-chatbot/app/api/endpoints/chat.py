from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.schemas.chat import ChatRequest, ChatResponse, HealthResponse
from app.services.llm import llm_service

router = APIRouter()


@router.post("/", response_model=ChatResponse, summary="Claude 메시지 전송")
async def send_chat(request: ChatRequest) -> ChatResponse:
    if settings.LLM_PROVIDER.lower() not in {"claude", "anthropic"}:
        raise HTTPException(
            status_code=503,
            detail="현재 AI 업무 배정은 Claude provider만 지원합니다.",
        )

    if not settings.effective_claude_api_key:
        raise HTTPException(
            status_code=503,
            detail="CLAUDE_API_KEY 또는 ANTHROPIC_API_KEY가 설정되지 않았습니다.",
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
            raise HTTPException(status_code=401, detail="Claude API 키가 유효하지 않습니다.")
        if "429" in error_msg or "rate" in error_msg.lower():
            raise HTTPException(
                status_code=429,
                detail="Claude API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
            )
        raise HTTPException(status_code=500, detail="AI 응답 생성 중 오류가 발생했습니다.")


@router.get("/health", response_model=HealthResponse, summary="상태 확인")
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        api_key_configured=bool(settings.effective_claude_api_key),
        model=settings.effective_claude_model,
    )
