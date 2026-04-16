from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class MessageRole(str, Enum):
    """메시지 역할"""
    user = "user"
    assistant = "assistant"


class ChatMessage(BaseModel):
    """개별 대화 메시지"""
    role: MessageRole
    content: str = Field(..., min_length=1, description="메시지 내용")


class ChatRequest(BaseModel):
    """채팅 요청 스키마"""
    messages: List[ChatMessage] = Field(..., min_length=1, description="대화 히스토리")
    system_prompt: Optional[str] = Field(None, description="커스텀 시스템 프롬프트")
    user_email: Optional[str] = Field(None, description="현재 사용자 이메일 (컨텍스트용)")


class TokenUsage(BaseModel):
    """토큰 사용량"""
    input_tokens: int
    output_tokens: int


class ChatResponse(BaseModel):
    """채팅 응답 스키마"""
    message: str = Field(..., description="AI 응답 메시지")
    usage: TokenUsage = Field(..., description="토큰 사용량")


class HealthResponse(BaseModel):
    """헬스체크 응답"""
    status: str
    api_key_configured: bool
    model: str
