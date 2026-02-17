from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class SourceCitation(BaseModel):
    document_id: int
    document_title: str
    chunk_content: str
    relevance_score: float
    page_number: Optional[int] = None


class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=8000)
    conversation_id: Optional[int] = None


class MessageResponse(BaseModel):
    id: int
    role: MessageRole
    content: str
    sources: Optional[List[SourceCitation]] = None
    tokens_used: Optional[int] = None
    latency_ms: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationCreate(BaseModel):
    title: Optional[str] = None


class ConversationResponse(BaseModel):
    id: int
    title: Optional[str] = None
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    model_config = {"from_attributes": True}


class ConversationWithMessages(ConversationResponse):
    messages: List[MessageResponse] = []


class StreamChunk(BaseModel):
    type: str  # "token" | "sources" | "done" | "error"
    content: Optional[str] = None
    sources: Optional[List[SourceCitation]] = None
    error: Optional[str] = None
