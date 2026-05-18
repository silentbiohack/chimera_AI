from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # populate_by_name lets Pydantic match either the field name or its
    # alias when reading env vars — important for DATABASE_URL which is
    # the de-facto Railway/Heroku/Render convention.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)

    environment: str = "development"
    log_level: str = "INFO"

    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    ws_token_expire_minutes: int = 5

    postgres_user: str = "chimera"
    postgres_password: str = "chimera"
    postgres_db: str = "chimera"
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    # Managed platforms (Railway, Render, Fly.io, Heroku, Supabase) inject
    # a single DATABASE_URL instead of POSTGRES_*. When present, it wins
    # over the discrete vars — see `database_url` property below.
    database_url_override: str = Field(default="", validation_alias="DATABASE_URL")

    redis_url: str = "redis://redis:6379/0"
    bus_mode: str = "auto"   # auto | redis | local

    llm_mode: str = "synthetic"   # synthetic | gemini
    gemini_api_key: str = ""
    gemini_pro_model: str = "gemini-1.5-pro"
    gemini_flash_model: str = "gemini-1.5-flash"

    arena_max_parallel_attacks: int = 8
    arena_mutation_budget: int = 64
    arena_tick_ms: int = 750

    # CORS origins as a comma-separated list. Star ("*") is allowed only in
    # development and is silently downgraded in production.
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        items = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        if self.environment == "production":
            items = [o for o in items if o != "*"]
        return items or ["http://localhost:3000"]

    @property
    def database_url(self) -> str:
        # Honour platform-injected DATABASE_URL when present. Railway and
        # Heroku still ship `postgres://` (no driver), so coerce it to the
        # psycopg2 dialect SQLAlchemy actually loads.
        if self.database_url_override:
            url = self.database_url_override
            if url.startswith("postgres://"):
                url = "postgresql+psycopg2://" + url[len("postgres://"):]
            elif url.startswith("postgresql://") and "+" not in url.split("://", 1)[0]:
                url = "postgresql+psycopg2://" + url[len("postgresql://"):]
            return url
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @field_validator("llm_mode", "bus_mode")
    @classmethod
    def _lower(cls, v: str) -> str:
        return (v or "").lower()

    @model_validator(mode="after")
    def _check_prod(self) -> "Settings":
        if self.environment == "production":
            if len(self.jwt_secret) < 32 or self.jwt_secret == "dev-secret-change-me":
                raise ValueError(
                    "JWT_SECRET must be set to ≥32 bytes in production"
                )
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
