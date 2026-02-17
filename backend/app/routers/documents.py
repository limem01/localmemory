import os
import json
import shutil
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import get_settings
from app.models.document import Document, DocumentStatus
from app.schemas.document import (
    DocumentResponse, DocumentListResponse, DocumentUpdate,
    IngestUrlRequest,
)
from app.dependencies import get_ingestion_service
from app.services.ingestion import IngestionService

router = APIRouter(prefix="/api/documents", tags=["documents"])
settings = get_settings()


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all documents with pagination and optional filtering."""
    query = db.query(Document)

    if status:
        try:
            status_enum = DocumentStatus(status)
            query = query.filter(Document.status == status_enum)
        except ValueError:
            pass

    if search:
        query = query.filter(Document.title.ilike(f"%{search}%"))

    total = query.count()
    docs = query.order_by(Document.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    items = []
    for doc in docs:
        doc_dict = {
            "id": doc.id,
            "title": doc.title,
            "filename": doc.filename,
            "file_size": doc.file_size,
            "doc_type": doc.doc_type,
            "status": doc.status,
            "chunk_count": doc.chunk_count,
            "tags": json.loads(doc.tags) if doc.tags else None,
            "error_message": doc.error_message,
            "is_watched": doc.is_watched,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at,
        }
        items.append(DocumentResponse(**doc_dict))

    return DocumentListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    ingestion_service: IngestionService = Depends(get_ingestion_service),
):
    """Upload and ingest a document."""
    # Validate file type
    ext = Path(file.filename).suffix.lower()
    if ext not in {".pdf", ".txt", ".docx", ".md"}:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Supported: .pdf, .txt, .docx, .md",
        )

    # Validate file size
    content = await file.read()
    if len(content) > settings.max_upload_size:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {settings.max_upload_size // 1024 // 1024}MB",
        )

    # Save to upload directory
    os.makedirs(settings.upload_dir, exist_ok=True)
    safe_filename = f"{os.urandom(8).hex()}_{file.filename}"
    file_path = os.path.join(settings.upload_dir, safe_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    # Parse tags
    parsed_tags = None
    if tags:
        try:
            parsed_tags = json.loads(tags)
        except Exception:
            parsed_tags = [t.strip() for t in tags.split(",") if t.strip()]

    try:
        doc = await ingestion_service.ingest_file(
            file_path=file_path,
            original_filename=file.filename,
            title=title,
            tags=parsed_tags,
        )
    except Exception as e:
        # Clean up file on failure
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))

    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        filename=doc.filename,
        file_size=doc.file_size,
        doc_type=doc.doc_type,
        status=doc.status,
        chunk_count=doc.chunk_count,
        tags=json.loads(doc.tags) if doc.tags else None,
        error_message=doc.error_message,
        is_watched=doc.is_watched,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: int, db: Session = Depends(get_db)):
    """Get a specific document by ID."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        filename=doc.filename,
        file_size=doc.file_size,
        doc_type=doc.doc_type,
        status=doc.status,
        chunk_count=doc.chunk_count,
        tags=json.loads(doc.tags) if doc.tags else None,
        error_message=doc.error_message,
        is_watched=doc.is_watched,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: int,
    update: DocumentUpdate,
    db: Session = Depends(get_db),
):
    """Update document metadata."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if update.title is not None:
        doc.title = update.title
    if update.tags is not None:
        doc.tags = json.dumps(update.tags)

    db.commit()
    db.refresh(doc)

    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        filename=doc.filename,
        file_size=doc.file_size,
        doc_type=doc.doc_type,
        status=doc.status,
        chunk_count=doc.chunk_count,
        tags=json.loads(doc.tags) if doc.tags else None,
        error_message=doc.error_message,
        is_watched=doc.is_watched,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    ingestion_service: IngestionService = Depends(get_ingestion_service),
):
    """Delete a document and all its data."""
    success = await ingestion_service.delete_document(document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted successfully"}


@router.post("/{document_id}/reprocess")
async def reprocess_document(
    document_id: int,
    db: Session = Depends(get_db),
    ingestion_service: IngestionService = Depends(get_ingestion_service),
):
    """Re-process a failed document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=400, detail="Original file not available for reprocessing")

    doc.status = DocumentStatus.PROCESSING
    doc.error_message = None
    doc.chunk_count = 0
    db.commit()

    try:
        await ingestion_service._process_document(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": "Document reprocessed successfully", "chunk_count": doc.chunk_count}
