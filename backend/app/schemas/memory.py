from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class MemoryType(str, Enum):
    FACT = "fact"
    PREFERENCE = "preference"
    INSIGHT = "insight"
    DIGEST = "digest"
    NOTE = "note"


class MemoryCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    content: str = Field(..., min_length=1)
    memory_type: MemoryType = MemoryType.NOTE
    importance_score: float = Field(0.5, ge=0.0, le=1.0)
    tags: Optional[List[str]] = None
    is_pinned: bool = False


class MemoryUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    memory_type: Optional[MemoryType] = None
    importance_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    tags: Optional[List[str]] = None
    is_pinned: Optional[bool] = None


class MemoryResponse(BaseModel):
    id: int
    title: str
    content: str
    memory_type: MemoryType
    importance_score: float
    tags: Optional[List[str]] = None
    is_pinned: bool
    source_document_id: Optional[int] = None
    source_conversation_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MemoryListResponse(BaseModel):
    items: List[MemoryResponse]
    total: int


class DigestResponse(BaseModel):
    date: str
    content: str
    memory_count: int
    document_count: int
