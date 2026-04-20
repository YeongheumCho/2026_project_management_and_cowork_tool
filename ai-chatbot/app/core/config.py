from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """AI Chatbot 서비스 설정"""

    # Claude API
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-5-20250929"
    CLAUDE_MAX_TOKENS: int = 4096

    # 서버
    AI_CHATBOT_HOST: str = "0.0.0.0"
    AI_CHATBOT_PORT: int = 8002

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # DB 연결 (백엔드 DB를 읽기 전용으로 사용)
    DATABASE_URL: str = "postgresql+psycopg2://cowork_user:password@db:5432/cowork_db"

    # 시스템 프롬프트
    SYSTEM_PROMPT: str = (
        "당신은 '프로젝트 관리 & 협업 툴'의 AI 어시스턴트입니다.\n\n"
        "역할:\n"
        "- 사용자의 프로젝트, 업무, 팀 데이터를 분석하고 인사이트를 제공합니다.\n"
        "- 업무 현황, 일정, 진행률, 팀원 배치 등의 질문에 데이터 기반으로 답변합니다.\n"
        "- 업무 우선순위 추천, 병목 분석, 리스크 알림 등 능동적 제안을 합니다.\n"
        "- 한국어로 친절하고 전문적으로 응답합니다.\n\n"
        "중요 규칙:\n"
        "- 아래 [현재 데이터]를 기반으로 사실에 근거한 답변만 합니다.\n"
        "- 데이터에 없는 내용은 '현재 확인할 수 없다'고 안내합니다.\n"
        "- 수치를 언급할 때는 데이터 출처를 함께 밝힙니다.\n"
    )

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
