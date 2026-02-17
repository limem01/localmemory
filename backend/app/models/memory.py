from sqlalchemy import Column, Integer, String, Text, Boolean, Float, Enum as SAEnum
import enum

from app.models.base import Base, TimestampMixin


class MemoryType(str, enum.Enum):
    FACT = "fact"
    PREFERENCE = "preference"
    INSIGHT = "insight"
    DIGEST = "digest"
    NOTE = "note"


class Memory(Base, TimestampMixin):
    __tablename__ = "memories"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(512), nullable=False)
    content = Column(Text, nullable=False)
    memory_type = Column(SAEnum(MemoryType), default=MemoryType.NOTE, nullable=False)
    source_document_id = Column(Integer, nullable=True, index=True)
    source_conversation_id = Column(Integer, nullable=True, index=True)
    importance_score = Column(Float, default=0.5, nullable=False)
    chroma_id = Column(String(256), nullable=True, unique=True, index=True)
    tags = Column(Text, nullable=True)  # JSON array
    is_pinned = Column(Boolean, default=False, nullable=False)

    def __repr__(self):
        return f"<Memory id={self.id} type={self.memory_type} title='{self.title[:50]}'>"
