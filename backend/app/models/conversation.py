from sqlalchemy import Column, Integer, String, Text, Boolean, Float, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import relationship
import enum

from app.models.base import Base, TimestampMixin


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Conversation(Base, TimestampMixin):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(512), nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)

    # Relationships
    messages = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan",
        order_by="Message.id"
    )

    def __repr__(self):
        return f"<Conversation id={self.id} title='{self.title}'>"


class Message(Base, TimestampMixin):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    role = Column(SAEnum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    sources = Column(Text, nullable=True)  # JSON array of source doc IDs/titles
    tokens_used = Column(Integer, nullable=True)
    latency_ms = Column(Float, nullable=True)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")

    def __repr__(self):
        return f"<Message id={self.id} role={self.role} conv={self.conversation_id}>"
