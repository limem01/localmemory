import chromadb
from chromadb.config import Settings as ChromaSettings
import hashlib
import uuid
import logging
from typing import List, Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_chroma_client: Optional[chromadb.PersistentClient] = None


def get_chroma_client() -> chromadb.PersistentClient:
    """Get or create the ChromaDB client (singleton)."""
    global _chroma_client
    if _chroma_client is None:
        import os
        os.makedirs(settings.chroma_path, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(
            path=settings.chroma_path,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        logger.info(f"ChromaDB initialized at {settings.chroma_path}")
    return _chroma_client


def get_collection(client: chromadb.PersistentClient = None):
    """Get or create the main ChromaDB collection."""
    if client is None:
        client = get_chroma_client()

    try:
        collection = client.get_collection(settings.chroma_collection)
    except Exception:
        collection = client.create_collection(
            name=settings.chroma_collection,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(f"Created ChromaDB collection: {settings.chroma_collection}")

    return collection


def generate_chunk_id(document_id: int, chunk_index: int, content: str) -> str:
    """Generate a deterministic ID for a chunk."""
    hash_input = f"{document_id}:{chunk_index}:{content[:100]}"
    return hashlib.sha256(hash_input.encode()).hexdigest()[:32]


def generate_memory_id() -> str:
    """Generate a unique ID for a memory entry."""
    return f"mem_{uuid.uuid4().hex[:16]}"


async def embed_and_store(
    chunks: List[dict],
    document_id: int,
    document_title: str,
    client: chromadb.PersistentClient = None,
) -> List[str]:
    """
    Embed text chunks and store them in ChromaDB.
    Returns list of chroma IDs.
    """
    import ollama

    if not chunks:
        return []

    if client is None:
        client = get_chroma_client()

    collection = get_collection(client)
    chroma_ids = []

    for chunk in chunks:
        try:
            # Generate embedding via Ollama
            response = ollama.embeddings(
                model=settings.ollama_embed_model,
                prompt=chunk["content"],
                host=settings.ollama_host,
            )
            embedding = response["embedding"]

            chunk_id = generate_chunk_id(document_id, chunk["index"], chunk["content"])

            collection.upsert(
                ids=[chunk_id],
                embeddings=[embedding],
                documents=[chunk["content"]],
                metadatas=[{
                    "document_id": document_id,
                    "document_title": document_title,
                    "chunk_index": chunk["index"],
                    "word_count": chunk.get("word_count", 0),
                    "page_number": chunk.get("page_number", -1),
                }],
            )
            chroma_ids.append(chunk_id)

        except Exception as e:
            logger.error(f"Failed to embed chunk {chunk['index']} of doc {document_id}: {e}")
            raise

    return chroma_ids


async def search_similar(
    query: str,
    top_k: int = None,
    document_ids: Optional[List[int]] = None,
    client: chromadb.PersistentClient = None,
) -> List[dict]:
    """
    Search for similar chunks using query embedding.
    Returns list of results with content, metadata, and score.
    """
    import ollama

    if top_k is None:
        top_k = settings.retrieval_top_k

    if client is None:
        client = get_chroma_client()

    collection = get_collection(client)

    # Check if collection has any documents
    count = collection.count()
    if count == 0:
        return []

    # Get query embedding
    response = ollama.embeddings(
        model=settings.ollama_embed_model,
        prompt=query,
        host=settings.ollama_host,
    )
    query_embedding = response["embedding"]

    # Build where clause for document filtering
    where = None
    if document_ids:
        where = {"document_id": {"$in": document_ids}}

    # Query ChromaDB
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, count),
        where=where,
        include=["documents", "metadatas", "distances"],
    )

    # Format results
    formatted = []
    if results["ids"] and results["ids"][0]:
        for i, chunk_id in enumerate(results["ids"][0]):
            distance = results["distances"][0][i]
            # Convert cosine distance to similarity score (0-1)
            score = 1 - distance

            if score >= settings.retrieval_score_threshold:
                formatted.append({
                    "chroma_id": chunk_id,
                    "content": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "score": score,
                })

    return sorted(formatted, key=lambda x: x["score"], reverse=True)


def delete_document_chunks(document_id: int, client: chromadb.PersistentClient = None):
    """Delete all ChromaDB entries for a document."""
    if client is None:
        client = get_chroma_client()

    collection = get_collection(client)

    try:
        collection.delete(where={"document_id": document_id})
        logger.info(f"Deleted ChromaDB chunks for document {document_id}")
    except Exception as e:
        logger.error(f"Failed to delete chunks for document {document_id}: {e}")
