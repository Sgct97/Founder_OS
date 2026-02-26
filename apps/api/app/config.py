"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Global application settings.

    All values are read from environment variables or a .env file.
    """

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/founder_os"
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""
    openai_api_key: str = ""
    cors_origins: str = "http://localhost:8081,http://localhost:19006"
    log_level: str = "INFO"
    upload_dir: str = "./uploads"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

