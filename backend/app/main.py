import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.database import init_db
from app.core.scheduler import scheduler, setup_scheduler
from app.routers import documents, chat, memory

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    logger.info(f"🧠 Starting {settings.app_name}...")

    # Ensure directories exist
    for directory in [settings.upload_dir, settings.watched_dir, settings.chroma_path]:
        os.makedirs(directory, exist_ok=True)

    # Initialize database
    init_db()
    logger.info("✅ Database initialized")

    # Start scheduler
    setup_scheduler()
    scheduler.start()
    logger.info("✅ Scheduler started")

    logger.info(f"🚀 {settings.app_name} is ready!")
    logger.info(f"   Ollama: {settings.ollama_host}")
    logger.info(f"   LLM Model: {settings.ollama_llm_model}")
    logger.info(f"   Embed Model: {settings.ollama_embed_model}")

    yield

    # Shutdown
    scheduler.shutdown(wait=False)
    logger.info(f"👋 {settings.app_name} shutting down")


app = FastAPI(
    title="LocalMemory API",
    description="Your private AI second brain — 100% local, proactive, and yours.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS - allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(memory.router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    from app.services.llm import LLMService
    llm = LLMService()
    ollama_ok = llm.check_health()
    models = llm.get_available_models() if ollama_ok else []

    return {
        "status": "healthy",
        "ollama": {
            "connected": ollama_ok,
            "host": settings.ollama_host,
            "llm_model": settings.ollama_llm_model,
            "embed_model": settings.ollama_embed_model,
            "available_models": models,
        },
        "app": settings.app_name,
        "version": "1.0.0",
    }


@app.get("/api/stats")
async def get_stats():
    """Get system statistics."""
    from app.core.database import SessionLocal
    from app.models.document import Document, DocumentStatus
    from app.models.conversation import Conversation, Message
    from app.models.memory import Memory
    from app.utils.embeddings import get_chroma_client, get_collection

    db = SessionLocal()
    try:
        doc_count = db.query(Document).filter(Document.status == DocumentStatus.READY).count()
        conv_count = db.query(Conversation).count()
        msg_count = db.query(Message).count()
        mem_count = db.query(Memory).count()

        # ChromaDB stats
        try:
            client = get_chroma_client()
            collection = get_collection(client)
            vector_count = collection.count()
        except Exception:
            vector_count = 0

        return {
            "documents": doc_count,
            "conversations": conv_count,
            "messages": msg_count,
            "memories": mem_count,
            "vectors": vector_count,
        }
    finally:
        db.close()


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
    )
