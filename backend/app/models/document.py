from sqlalchemy import Column, Integer, String, Text, Boolean, BigInteger, Enum as SAEnum
from sqlalchemy.orm import relationship
import enum

from app.models.base import Base, TimestampMixin


class DocumentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class DocumentType(str, enum.Enum):
    PDF = "pdf"
    TXT = "txt"
    DOCX = "docx"
    MD = "md"
    UNKNOWN = "unknown"


class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(512), nullable=False)
    filename = Column(String(512), nullable=False)
    file_path = Column(String(1024), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    doc_type = Column(SAEnum(DocumentType), default=DocumentType.UNKNOWN, nullable=False)
    status = Column(SAEnum(DocumentStatus), default=DocumentStatus.PENDING, nullable=False)
    chunk_count = Column(Integer, default=0, nullable=False)
    source_url = Column(String(2048), nullable=True)
    tags = Column(Text, nullable=True)  # JSON array stored as text
    error_message = Column(Text, nullable=True)
    is_watched = Column(Boolean, default=False, nullable=False)
    content_hash = Column(String(64), nullable=True, unique=True, index=True)

    # Relationships
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Document id={self.id} title='{self.title}' status={self.status}>"


class DocumentChunk(Base, TimestampMixin):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    chroma_id = Column(String(256), nullable=True, unique=True, index=True)
    page_number = Column(Integer, nullable=True)
    word_count = Column(Integer, default=0)

    # Relationships
    document = relationship("Document", back_populates="chunks", foreign_keys=[document_id])

    def __repr__(self):
        return f"<DocumentChunk id={self.id} doc_id={self.document_id} chunk={self.chunk_index}>"
