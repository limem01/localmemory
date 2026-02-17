import logging
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.document import Document, DocumentChunk
from app.utils.embeddings import search_similar, get_chroma_client
from app.schemas.chat import SourceCitation
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class RetrievalService:
    def __init__(self, db: Session):
        self.db = db
        self.client = get_chroma_client()

    async def retrieve_context(
        self,
        query: str,
        top_k: int = None,
        document_ids: Optional[List[int]] = None,
    ) -> List[SourceCitation]:
        """
        Retrieve relevant context chunks for a query.
        Returns list of SourceCitation objects.
        """
        if top_k is None:
            top_k = settings.retrieval_top_k

        try:
            results = await search_similar(
                query=query,
                top_k=top_k,
                document_ids=document_ids,
                client=self.client,
            )
        except Exception as e:
            logger.error(f"Retrieval failed: {e}")
            return []

        citations = []
        for result in results:
            metadata = result["metadata"]
            doc_id = metadata.get("document_id")

            # Get document info from DB
            doc = self.db.query(Document).filter(Document.id == doc_id).first()
            if not doc:
                continue

            citation = SourceCitation(
                document_id=doc.id,
                document_title=doc.title,
                chunk_content=result["content"],
                relevance_score=round(result["score"], 4),
                page_number=metadata.get("page_number") if metadata.get("page_number", -1) >= 0 else None,
            )
            citations.append(citation)

        return citations

    def build_context_prompt(self, citations: List[SourceCitation]) -> str:
        """Build a context string from citations for the LLM prompt."""
        if not citations:
            return ""

        parts = ["RELEVANT CONTEXT FROM YOUR KNOWLEDGE BASE:\n"]
        for i, citation in enumerate(citations, 1):
            parts.append(
                f"[Source {i}: {citation.document_title}]\n"
                f"{citation.chunk_content}\n"
            )

        parts.append("\nUse the above context to answer the user's question.")
        return "\n".join(parts)
