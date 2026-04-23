from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """AI Chatbot service settings."""

    # Provider
    LLM_PROVIDER: str = "claude"

    # Claude / Anthropic
    CLAUDE_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-5-20250929"
    ANTHROPIC_MODEL: str = ""
    CLAUDE_MAX_TOKENS: int = 4096

    # Server
    AI_CHATBOT_HOST: str = "0.0.0.0"
    AI_CHATBOT_PORT: int = 8002

    # CORS
    CORS_ORIGINS_RAW: str = Field(
        default="http://localhost:5173,http://localhost:3000",
        alias="CORS_ORIGINS",
    )

    # DB
    DATABASE_URL: str = "postgresql+psycopg2://cowork_user:password@db:5432/cowork_db"

    SYSTEM_PROMPT: str = (
        "당신은 '프로젝트 관리 및 업무 배정 AI 어시스턴트'입니다.\n\n"
        "역할:\n"
        "- 사용자의 프로젝트, 업무, 팀 데이터를 분석하고 인사이트를 제공합니다.\n"
        "- 업무 부하, 일정, 진행률, 담당 배치를 질문과 데이터 기반으로 답변합니다.\n"
        "- 우선순위 추천, 병목 분석, 리스크 알림 및 협업 방향을 제안합니다.\n"
        "- 친근하고 간결하며 실무적으로 답변합니다.\n\n"
        "중요 규칙:\n"
        "- 아래 현재 데이터를 기반으로 사실과 근거 위주로만 답합니다.\n"
        "- 데이터에 없는 내용은 '현재 확인된 정보가 없다'고 안내합니다.\n"
        "- 수치와 판단은 가능한 경우 근거를 함께 제시합니다.\n"
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @computed_field
    @property
    def effective_claude_api_key(self) -> str:
        return (self.CLAUDE_API_KEY or self.ANTHROPIC_API_KEY).strip()

    @computed_field
    @property
    def effective_claude_model(self) -> str:
        return (self.CLAUDE_MODEL or self.ANTHROPIC_MODEL or "claude-sonnet-4-5-20250929").strip()

    @computed_field
    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.CORS_ORIGINS_RAW.split(",")
            if origin.strip()
        ]

    @property
    def CORS_ORIGINS(self) -> list[str]:
        return self.cors_origins


settings = Settings()
