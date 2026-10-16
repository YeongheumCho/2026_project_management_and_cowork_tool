from pathlib import Path
import json

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def parse_origin_list(value: str) -> list[str]:
    value = value.strip()
    if not value:
        return []
    if value.startswith("["):
        parsed = json.loads(value)
        return [str(origin).strip() for origin in parsed if str(origin).strip()]
    return [origin.strip() for origin in value.split(",") if origin.strip()]


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000"
    AI_CHATBOT_URL: str = "http://ai-chatbot:8002/api/chat/"
    AI_ASSIGNMENT_USE_CLAUDE: bool = True
    # 실행하는 SQL 을 모두 로그로 남길지. 켜 두면 로그가 빠르게 쌓이므로 문제를 볼 때만 켠다.
    SQL_ECHO: bool = False

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        extra="ignore"
    )

    @property
    def backend_cors_origins(self) -> list[str]:
        return parse_origin_list(self.BACKEND_CORS_ORIGINS)

settings = Settings()
