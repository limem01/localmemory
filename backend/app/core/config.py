from pydantic_settings import BaseSettings
from pydantic import Field
from pathlib import Path
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "LocalMemory"
    secret_key: str = "change-me-in-production-use-a-long-random-string"
    debug: bool = False

    # Ollama
    ollama_host: str = "http://localhost:11434"
    ollama_llm_model: str = "llama3.2"
    ollama_embed_model: str = "nomic-embed-text"

    # Database
    database_url: str = "sqlite:////app/data/localmemory.db"

    # ChromaDB
    chroma_path: str = "/app/data/chroma"
    chroma_collection: str = "localmemory"

    # File storage
    upload_dir: str = "/app/data/uploads"
    watched_dir: str = "/app/data/watched"
    max_upload_size: int = 50 * 1024 * 1024  # 50MB

    # Chunking
    chunk_size: int = 1000
    chunk_overlap: int = 200

    # Retrieval
    retrieval_top_k: int = 5
    retrieval_score_threshold: float = 0.3

    # Scheduler
    digest_hour: int = 8
    digest_minute: int = 0

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
