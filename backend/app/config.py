"""Application configuration, loaded from environment variables (.env)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Server-side settings. The Databricks token lives here and never reaches the browser."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Databricks workspace, e.g. https://adb-xxxx.azuredatabricks.net (no trailing slash)
    databricks_host: str = "https://adb-3011697725699826.6.azuredatabricks.net"
    # Personal access token (Bearer). Set this in backend/.env — do NOT commit it.
    databricks_token: str = ""

    # SQL warehouse used for the Statement Execution API (today's schedule).
    warehouse_id: str = "17f6d9fabd1c7633"

    # Model serving endpoint name for the agent (missing assignments / chat).
    serving_endpoint: str = "mas-e8cd6cde-endpoint"

    # Request timeout (seconds) for Databricks calls.
    request_timeout: float = 180.0

    # Comma-separated list of allowed CORS origins for the frontend dev server.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
