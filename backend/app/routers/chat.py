import json
import time
import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.conversation import Conversation, Message, MessageRole
from app.schemas.chat import (
    ChatMessageCreate, ConversationCreate, ConversationResponse,
    ConversationWithMessages, MessageResponse, SourceCitation,
)
from app.dependencies import get_retrieval_service, get_llm_service
from app.services.retrieval import RetrievalService
from app.services.llm import LLMService

router = APIRouter(prefix="/api/chat", tags=["chat"])
logger = logging.getLogger(__name__)


@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List all conversations."""
    convs = db.query(Conversation).filter(
        Conversation.is_archived == False
    ).order_by(Conversation.updated_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    result = []
    for conv in convs:
        msg_count = db.query(Message).filter(Message.conversation_id == conv.id).count()
        result.append(ConversationResponse(
            id=conv.id,
            title=conv.title,
            is_archived=conv.is_archived,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            message_count=msg_count,
        ))
    return result


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    data: ConversationCreate,
    db: Session = Depends(get_db),
):
    """Create a new conversation."""
    conv = Conversation(title=data.title or "New Conversation")
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return ConversationResponse(
        id=conv.id, title=conv.title, is_archived=conv.is_archived,
        created_at=conv.created_at, updated_at=conv.updated_at, message_count=0,
    )


@router.get("/conversations/{conv_id}", response_model=ConversationWithMessages)
async def get_conversation(conv_id: int, db: Session = Depends(get_db)):
    """Get a conversation with all messages."""
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = db.query(Message).filter(
        Message.conversation_id == conv_id
    ).order_by(Message.id).all()

    msg_responses = []
    for msg in messages:
        sources = None
        if msg.sources:
            try:
                raw_sources = json.loads(msg.sources)
                sources = [SourceCitation(**s) for s in raw_sources]
            except Exception:
                pass
        msg_responses.append(MessageResponse(
            id=msg.id, role=msg.role, content=msg.content,
            sources=sources, tokens_used=msg.tokens_used,
            latency_ms=msg.latency_ms, created_at=msg.created_at,
        ))

    return ConversationWithMessages(
        id=conv.id, title=conv.title, is_archived=conv.is_archived,
        created_at=conv.created_at, updated_at=conv.updated_at,
        message_count=len(messages), messages=msg_responses,
    )


@router.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: int, db: Session = Depends(get_db)):
    """Delete a conversation."""
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted"}


@router.post("/stream")
async def chat_stream(
    data: ChatMessageCreate,
    db: Session = Depends(get_db),
    retrieval_service: RetrievalService = Depends(get_retrieval_service),
    llm_service: LLMService = Depends(get_llm_service),
):
    """
    Send a chat message and receive a streaming SSE response.
    Creates a new conversation if none specified.
    """
    # Get or create conversation
    if data.conversation_id:
        conv = db.query(Conversation).filter(Conversation.id == data.conversation_id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conv = Conversation(title=data.content[:60] + "..." if len(data.content) > 60 else data.content)
        db.add(conv)
        db.commit()
        db.refresh(conv)

    # Save user message
    user_msg = Message(
        conversation_id=conv.id,
        role=MessageRole.USER,
        content=data.content,
    )
    db.add(user_msg)
    db.commit()

    # Get conversation history for context
    history_messages = db.query(Message).filter(
        Message.conversation_id == conv.id,
    ).order_by(Message.id).limit(20).all()

    history = [
        {"role": msg.role.value, "content": msg.content}
        for msg in history_messages[:-1]  # Exclude the just-added user message
    ]

    async def generate():
        start_time = time.time()
        full_response = ""
        citations = []

        try:
            # Retrieve context
            citations = await retrieval_service.retrieve_context(data.content)
            context = retrieval_service.build_context_prompt(citations)

            # Send sources first
            if citations:
                sources_data = [c.model_dump() for c in citations]
                yield f"data: {json.dumps({'type': 'sources', 'sources': sources_data})}\n\n"

            # Stream LLM response
            async for token in llm_service.generate_stream(
                user_message=data.content,
                context=context,
                history=history,
            ):
                full_response += token
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            # Calculate latency
            latency_ms = (time.time() - start_time) * 1000

            # Save assistant message
            sources_json = json.dumps([c.model_dump() for c in citations]) if citations else None
            assistant_msg = Message(
                conversation_id=conv.id,
                role=MessageRole.ASSISTANT,
                content=full_response,
                sources=sources_json,
                latency_ms=latency_ms,
            )
            db.add(assistant_msg)

            # Update conversation title if it's the first exchange
            msg_count = db.query(Message).filter(Message.conversation_id == conv.id).count()
            if msg_count <= 2 and conv.title == data.content[:60]:
                # Keep current title (first user message)
                pass

            db.commit()

            # Send done signal with conversation ID
            yield f"data: {json.dumps({'type': 'done', 'conversation_id': conv.id, 'message_id': assistant_msg.id})}\n\n"

        except Exception as e:
            logger.error(f"Chat stream error: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
