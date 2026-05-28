from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # App
    APP_NAME: str = "Portal BI"
    SECRET_KEY: str = "change-this-super-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 horas

    # Database (Supabase PostgreSQL — Transaction Mode porta 6543)
    DATABASE_URL: str = "postgresql://postgres:senha@db.xxxx.supabase.co:5432/postgres"

    # OpenAI / OpenRouter
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "openai/gpt-4o"
    # Para OpenRouter: https://openrouter.ai/api/v1
    # Para OpenAI direto: deixe vazio
    OPENAI_BASE_URL: str = "https://openrouter.ai/api/v1"

    # Supabase Storage
    SUPABASE_URL: str = ""           # https://xxxx.supabase.co
    SUPABASE_SERVICE_KEY: str = ""   # service_role key (Settings > API)
    SUPABASE_BUCKET_COVERS: str = "covers"
    SUPABASE_BUCKET_PARQUET: str = "parquet"

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"

settings = Settings()
