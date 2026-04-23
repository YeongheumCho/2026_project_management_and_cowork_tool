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
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        extra="ignore"
    )

    @property
    def backend_cors_origins(self) -> list[str]:
        return parse_origin_list(self.BACKEND_CORS_ORIGINS)

settings = Settings()
