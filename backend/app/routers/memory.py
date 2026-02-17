import json
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.memory import Memory, MemoryType
from app.schemas.memory import (
    MemoryCreate, MemoryUpdate, MemoryResponse, MemoryListResponse, DigestResponse
)
from app.dependencies import get_proactive_service
from app.services.proactive import ProactiveService

router = APIRouter(prefix="/api/memory", tags=["memory"])
logger = logging.getLogger(__name__)


def _to_response(mem: Memory) -> MemoryResponse:
    return MemoryResponse(
        id=mem.id,
        title=mem.title,
        content=mem.content,
        memory_type=mem.memory_type,
        importance_score=mem.importance_score,
        tags=json.loads(mem.tags) if mem.tags else None,
        is_pinned=mem.is_pinned,
        source_document_id=mem.source_document_id,
        source_conversation_id=mem.source_conversation_id,
        created_at=mem.created_at,
        updated_at=mem.updated_at,
    )


@router.get("", response_model=MemoryListResponse)
async def list_memories(
    memory_type: Optional[str] = None,
    is_pinned: Optional[bool] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List all memories with filtering."""
    query = db.query(Memory)

    if memory_type:
        try:
            type_enum = MemoryType(memory_type)
            query = query.filter(Memory.memory_type == type_enum)
        except ValueError:
            pass

    if is_pinned is not None:
        query = query.filter(Memory.is_pinned == is_pinned)

    if search:
        query = query.filter(
            Memory.title.ilike(f"%{search}%") | Memory.content.ilike(f"%{search}%")
        )

    total = query.count()
    memories = query.order_by(
        Memory.is_pinned.desc(),
        Memory.importance_score.desc(),
        Memory.created_at.desc(),
    ).offset((page - 1) * page_size).limit(page_size).all()

    return MemoryListResponse(items=[_to_response(m) for m in memories], total=total)


@router.post("", response_model=MemoryResponse)
async def create_memory(data: MemoryCreate, db: Session = Depends(get_db)):
    """Create a new memory."""
    mem = Memory(
        title=data.title,
        content=data.content,
        memory_type=data.memory_type,
        importance_score=data.importance_score,
        tags=json.dumps(data.tags) if data.tags else None,
        is_pinned=data.is_pinned,
    )
    db.add(mem)
    db.commit()
    db.refresh(mem)
    return _to_response(mem)


@router.get("/digest/today", response_model=DigestResponse)
async def get_today_digest(
    db: Session = Depends(get_db),
    proactive_service: ProactiveService = Depends(get_proactive_service),
):
    """Get or generate today's digest."""
    today = date.today()
    title = f"Daily Digest — {today.strftime('%B %d, %Y')}"

    existing = db.query(Memory).filter(
        Memory.memory_type == MemoryType.DIGEST,
        Memory.title == title,
    ).first()

    if existing:
        from app.models.document import Document, DocumentStatus
        from sqlalchemy import func
        from datetime import datetime, timezone, timedelta

        doc_count = db.query(Document).filter(
            Document.status == DocumentStatus.READY,
            func.date(Document.created_at) >= (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat(),
        ).count()

        return DigestResponse(
            date=today.isoformat(),
            content=existing.content,
            memory_count=db.query(Memory).count(),
            document_count=doc_count,
        )

    # Generate new digest
    content = await proactive_service.generate_daily_digest()
    if not content:
        content = f"No new activity on {today.strftime('%B %d, %Y')}. Start by adding some documents to your knowledge base!"

    from app.models.document import Document, DocumentStatus
    doc_count = db.query(Document).filter(Document.status == DocumentStatus.READY).count()
    mem_count = db.query(Memory).count()

    return DigestResponse(
        date=today.isoformat(),
        content=content,
        memory_count=mem_count,
        document_count=doc_count,
    )


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_memory(memory_id: int, db: Session = Depends(get_db)):
    """Get a specific memory."""
    mem = db.query(Memory).filter(Memory.id == memory_id).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found")
    return _to_response(mem)


@router.patch("/{memory_id}", response_model=MemoryResponse)
async def update_memory(
    memory_id: int, update: MemoryUpdate, db: Session = Depends(get_db)
):
    """Update a memory."""
    mem = db.query(Memory).filter(Memory.id == memory_id).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found")

    if update.title is not None:
        mem.title = update.title
    if update.content is not None:
        mem.content = update.content
    if update.memory_type is not None:
        mem.memory_type = update.memory_type
    if update.importance_score is not None:
        mem.importance_score = update.importance_score
    if update.tags is not None:
        mem.tags = json.dumps(update.tags)
    if update.is_pinned is not None:
        mem.is_pinned = update.is_pinned

    db.commit()
    db.refresh(mem)
    return _to_response(mem)


@router.delete("/{memory_id}")
async def delete_memory(memory_id: int, db: Session = Depends(get_db)):
    """Delete a memory."""
    mem = db.query(Memory).filter(Memory.id == memory_id).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found")
    db.delete(mem)
    db.commit()
    return {"message": "Memory deleted"}


@router.post("/{memory_id}/pin")
async def toggle_pin(memory_id: int, db: Session = Depends(get_db)):
    """Toggle pinned status of a memory."""
    mem = db.query(Memory).filter(Memory.id == memory_id).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found")
    mem.is_pinned = not mem.is_pinned
    db.commit()
    return {"is_pinned": mem.is_pinned}
