from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class DocumentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class DocumentType(str, Enum):
    PDF = "pdf"
    TXT = "txt"
    DOCX = "docx"
    MD = "md"
    UNKNOWN = "unknown"


class DocumentBase(BaseModel):
    title: str
    tags: Optional[List[str]] = None


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    tags: Optional[List[str]] = None


class DocumentChunkResponse(BaseModel):
    id: int
    chunk_index: int
    content: str
    page_number: Optional[int] = None
    word_count: int

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    id: int
    title: str
    filename: str
    file_size: Optional[int] = None
    doc_type: DocumentType
    status: DocumentStatus
    chunk_count: int
    tags: Optional[List[str]] = None
    error_message: Optional[str] = None
    is_watched: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    items: List[DocumentResponse]
    total: int
    page: int
    page_size: int


class IngestUrlRequest(BaseModel):
    url: str = Field(..., description="URL to ingest content from")
    title: Optional[str] = None
    tags: Optional[List[str]] = None
