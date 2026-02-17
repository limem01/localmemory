import logging
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.document import Document, DocumentStatus
from app.models.conversation import Conversation, Message
from app.models.memory import Memory, MemoryType
from app.services.llm import LLMService
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ProactiveService:
    def __init__(self, db: Session):
        self.db = db
        self.llm = LLMService()

    async def generate_daily_digest(self) -> Optional[str]:
        """
        Generate a daily digest of recent activity and memories.
        Returns the digest content as a string.
        """
        today = datetime.now(timezone.utc).date()
        yesterday = today - timedelta(days=1)

        # Gather recent data
        recent_docs = self.db.query(Document).filter(
            Document.status == DocumentStatus.READY,
            func.date(Document.created_at) >= yesterday.isoformat(),
        ).all()

        recent_messages = self.db.query(Message).filter(
            func.date(Message.created_at) >= yesterday.isoformat(),
        ).count()

        pinned_memories = self.db.query(Memory).filter(
            Memory.is_pinned == True
        ).order_by(Memory.importance_score.desc()).limit(5).all()

        # Build digest prompt
        doc_list = "\n".join([f"- {doc.title} ({doc.chunk_count} chunks)" for doc in recent_docs])
        memory_list = "\n".join([f"- {m.title}: {m.content[:200]}" for m in pinned_memories])

        prompt = f"""Generate a brief daily digest for {today.strftime('%B %d, %Y')}.

RECENT ACTIVITY (last 24 hours):
- Documents added: {len(recent_docs)}
{doc_list if doc_list else "  (none)"}
- Chat messages exchanged: {recent_messages}

TOP PINNED MEMORIES:
{memory_list if memory_list else "(none yet)"}

Write a concise, friendly digest (2-3 paragraphs) that:
1. Summarizes what was added to the knowledge base
2. Highlights any important pinned memories
3. Suggests a follow-up question or topic to explore

Keep it conversational and under 250 words."""

        try:
            digest_content = await self.llm.generate(
                prompt=prompt,
                system="You are a helpful personal knowledge assistant creating a daily digest.",
                temperature=0.6,
                max_tokens=500,
            )

            # Store as a memory
            memory = Memory(
                title=f"Daily Digest — {today.strftime('%B %d, %Y')}",
                content=digest_content,
                memory_type=MemoryType.DIGEST,
                importance_score=0.6,
                tags=json.dumps(["digest", "auto-generated"]),
            )
            self.db.add(memory)
            self.db.commit()

            logger.info(f"Daily digest generated for {today}")
            return digest_content

        except Exception as e:
            logger.error(f"Failed to generate daily digest: {e}", exc_info=True)
            return None

    async def extract_memories_from_conversation(
        self, conversation_id: int, message_content: str
    ) -> list:
        """Extract potential memories from a conversation turn."""
        prompt = f"""Analyze this conversation message and extract any facts, preferences, or insights worth remembering long-term.

Message: {message_content[:1000]}

If there are memorable facts or preferences, list them as JSON array:
[{{"title": "...", "content": "...", "type": "fact|preference|insight"}}]

If nothing is worth remembering, return: []

Return ONLY valid JSON, no other text."""

        try:
            response = await self.llm.generate(prompt=prompt, temperature=0.3, max_tokens=500)
            response = response.strip()

            # Extract JSON from response
            start = response.find("[")
            end = response.rfind("]") + 1
            if start >= 0 and end > start:
                data = json.loads(response[start:end])
                return data[:3]  # Max 3 memories per turn
        except Exception as e:
            logger.debug(f"Memory extraction skipped: {e}")

        return []
