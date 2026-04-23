import json

from pydantic_settings import BaseSettings


def parse_origin_list(value: str) -> list[str]:
    value = value.strip()
    if not value:
        return []
    if value.startswith("["):
        parsed = json.loads(value)
        return [str(origin).strip() for origin in parsed if str(origin).strip()]
    return [origin.strip() for origin in value.split(",") if origin.strip()]


class Settings(BaseSettings):
    REALTIME_PORT: int = 8001
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "changeme"
    ALGORITHM: str = "HS256"
    REALTIME_ALLOWED_ORIGINS: str = "http://localhost:3000"

    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "cowork_db"
    POSTGRES_USER: str = "cowork_user"
    POSTGRES_PASSWORD: str = ""

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    class Config:
        env_file = ".env"

    @property
    def allowed_origins(self) -> list[str]:
        return parse_origin_list(self.REALTIME_ALLOWED_ORIGINS)


settings = Settings()
