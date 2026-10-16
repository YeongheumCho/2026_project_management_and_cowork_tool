import asyncio
import time

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.schemas.chat import ChatRequest, ChatResponse, HealthResponse
from app.services.llm import llm_service

router = APIRouter()

CLAUDE_HOST = "api.anthropic.com"
REACHABILITY_TTL_SEC = 300
_reachability: dict[str, float | bool] = {"checked_at": 0.0, "ok": False}


async def _claude_reachable() -> bool:
    """Claude API 서버에 TCP 로 붙어 보고 결과를 5분간 기억한다.

    폐쇄망에는 인터넷이 없어 챗봇을 눌러도 오류만 났다.
    화면이 이 값을 보고 챗봇 버튼을 숨긴다. 매 화면마다 묻지 않도록 결과를 기억한다.
    """
    now = time.monotonic()
    if now - float(_reachability["checked_at"]) < REACHABILITY_TTL_SEC and _reachability["checked_at"]:
        return bool(_reachability["ok"])
    try:
        _, writer = await asyncio.wait_for(asyncio.open_connection(CLAUDE_HOST, 443), timeout=2)
        writer.close()
        ok = True
    except Exception:
        ok = False
    _reachability.update(checked_at=now, ok=ok)
    return ok


async def _send_chat(request: ChatRequest) -> ChatResponse:
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


@router.post("/", response_model=ChatResponse, summary="Claude 메시지 전송")
async def send_chat(request: ChatRequest) -> ChatResponse:
    return await _send_chat(request)


@router.post("", response_model=ChatResponse, include_in_schema=False)
async def send_chat_no_slash(request: ChatRequest) -> ChatResponse:
    # Next.js rewrite 등에서 trailing slash가 누락되어도 동일하게 처리.
    return await _send_chat(request)


@router.get("/health", response_model=HealthResponse, summary="상태 확인")
async def health_check() -> HealthResponse:
    configured = bool(settings.effective_claude_api_key)
    # 키가 없으면 연결해 볼 필요도 없다.
    reachable = await _claude_reachable() if configured else False
    return HealthResponse(
        status="ok",
        api_key_configured=configured,
        model=settings.effective_claude_model,
        reachable=reachable,
        available=configured and reachable,
    )
