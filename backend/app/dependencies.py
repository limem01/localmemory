from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.ingestion import IngestionService
from app.services.retrieval import RetrievalService
from app.services.llm import LLMService
from app.services.proactive import ProactiveService


def get_ingestion_service(db: Session = Depends(get_db)) -> IngestionService:
    return IngestionService(db)


def get_retrieval_service(db: Session = Depends(get_db)) -> RetrievalService:
    return RetrievalService(db)


def get_llm_service() -> LLMService:
    return LLMService()


def get_proactive_service(db: Session = Depends(get_db)) -> ProactiveService:
    return ProactiveService(db)
