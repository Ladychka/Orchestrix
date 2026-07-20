import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GEMINI_API_KEY: str = ""
    DATABASE_URL: str = "postgresql://aiep:aiep@localhost:5432/aiep"
    QDRANT_URL: str = "http://localhost:6333"
    REDIS_URL: str = "redis://localhost:6379/0"
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_APPROVER_CHAT_ID: str = ""
    EMAIL_HOST: str = "smtp.gmail.com"
    EMAIL_PORT: int = 587
    EMAIL_USER: str = ""
    EMAIL_PASS: str = ""

    # Ollama (replaces Gemini)
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "kimi-k2.6:cloud"

    class Config:
        env_file = ".env"


settings = Settings()
