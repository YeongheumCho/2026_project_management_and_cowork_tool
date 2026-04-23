import anthropic
from typing import List

from app.core.config import settings
from app.schemas.chat import ChatMessage, ChatResponse, TokenUsage
from app.services.context import fetch_context_for_user


class LLMService:
    """Claude API-backed LLM service."""

    def __init__(self) -> None:
        self._client: anthropic.AsyncAnthropic | None = None

    @property
    def client(self) -> anthropic.AsyncAnthropic:
        if self._client is None:
            self._client = anthropic.AsyncAnthropic(
                api_key=settings.effective_claude_api_key,
            )
        return self._client

    async def chat(
        self,
        messages: List[ChatMessage],
        system_prompt: str | None = None,
        user_email: str | None = None,
    ) -> ChatResponse:
        base_prompt = system_prompt or settings.SYSTEM_PROMPT
        db_context = fetch_context_for_user(user_email)
        full_system = f"{base_prompt}\n{db_context}"

        response = await self.client.messages.create(
            model=settings.effective_claude_model,
            max_tokens=settings.CLAUDE_MAX_TOKENS,
            system=full_system,
            messages=[{"role": msg.role.value, "content": msg.content} for msg in messages],
        )

        assistant_text = "\n".join(
            block.text for block in response.content if block.type == "text"
        )

        return ChatResponse(
            message=assistant_text,
            usage=TokenUsage(
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
            ),
        )


llm_service = LLMService()
