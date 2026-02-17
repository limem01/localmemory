from typing import List, Dict, Any
import re

from app.core.config import get_settings

settings = get_settings()


def chunk_text(
    text: str,
    chunk_size: int = None,
    chunk_overlap: int = None,
) -> List[Dict[str, Any]]:
    """
    Split text into overlapping chunks suitable for embedding.
    Returns list of dicts with 'content', 'index', and 'word_count'.
    """
    if chunk_size is None:
        chunk_size = settings.chunk_size
    if chunk_overlap is None:
        chunk_overlap = settings.chunk_overlap

    # Clean the text
    text = clean_text(text)

    if not text.strip():
        return []

    # Split by sentences first for better coherence
    sentences = split_into_sentences(text)

    chunks = []
    current_chunk = []
    current_len = 0
    chunk_index = 0

    for sentence in sentences:
        sentence_len = len(sentence)

        # If single sentence exceeds chunk size, split it hard
        if sentence_len > chunk_size:
            # Flush current chunk first
            if current_chunk:
                content = " ".join(current_chunk)
                chunks.append({
                    "content": content,
                    "index": chunk_index,
                    "word_count": len(content.split()),
                })
                chunk_index += 1
                current_chunk = []
                current_len = 0

            # Hard split the long sentence
            for i in range(0, len(sentence), chunk_size - chunk_overlap):
                piece = sentence[i:i + chunk_size]
                if piece.strip():
                    chunks.append({
                        "content": piece,
                        "index": chunk_index,
                        "word_count": len(piece.split()),
                    })
                    chunk_index += 1
            continue

        # If adding this sentence exceeds chunk size, flush and start new chunk
        if current_len + sentence_len > chunk_size and current_chunk:
            content = " ".join(current_chunk)
            chunks.append({
                "content": content,
                "index": chunk_index,
                "word_count": len(content.split()),
            })
            chunk_index += 1

            # Keep overlap sentences
            overlap_sentences = []
            overlap_len = 0
            for s in reversed(current_chunk):
                if overlap_len + len(s) <= chunk_overlap:
                    overlap_sentences.insert(0, s)
                    overlap_len += len(s)
                else:
                    break
            current_chunk = overlap_sentences
            current_len = overlap_len

        current_chunk.append(sentence)
        current_len += sentence_len

    # Flush remaining
    if current_chunk:
        content = " ".join(current_chunk)
        chunks.append({
            "content": content,
            "index": chunk_index,
            "word_count": len(content.split()),
        })

    return chunks


def split_into_sentences(text: str) -> List[str]:
    """Split text into sentences using simple regex."""
    # Split on sentence-ending punctuation followed by whitespace
    pattern = r'(?<=[.!?])\s+'
    sentences = re.split(pattern, text)
    return [s.strip() for s in sentences if s.strip()]


def clean_text(text: str) -> str:
    """Clean text by removing excessive whitespace and control characters."""
    # Remove null bytes
    text = text.replace('\x00', '')
    # Normalize whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()
