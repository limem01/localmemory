import logging
from typing import AsyncGenerator, List, Optional

import ollama

from app.core.config import get_settings
from app.schemas.chat import SourceCitation

logger = logging.getLogger(__name__)
settings = get_settings()

SYSTEM_PROMPT = """You are LocalMemory, an intelligent personal assistant that helps users explore and understand their personal knowledge base.

You have access to documents and notes the user has added to their private second brain. When answering questions:
1. Use the provided context from their knowledge base when relevant
2. Be concise, clear, and helpful
3. Cite your sources naturally (e.g., "According to your notes on X...")
4. If the context doesn't contain enough information, say so honestly
5. Never make up information — if you don't know, say so

You are running 100% locally. All data stays on the user's machine."""


class LLMService:
    def __init__(self):
        self.client = ollama.Client(host=settings.ollama_host)
        self.model = settings.ollama_llm_model

    def check_health(self) -> bool:
        """Check if Ollama is running and model is available."""
        try:
            models = self.client.list()
            model_names = [m["name"] for m in models.get("models", [])]
            return any(self.model in name for name in model_names)
        except Exception as e:
            logger.warning(f"Ollama health check failed: {e}")
            return False

    def get_available_models(self) -> List[str]:
        """Get list of available Ollama models."""
        try:
            models = self.client.list()
            return [m["name"] for m in models.get("models", [])]
        except Exception:
            return []

    def build_messages(
        self,
        user_message: str,
        context: str = "",
        history: Optional[List[dict]] = None,
    ) -> List[dict]:
        """Build message list for the LLM."""
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        # Add conversation history (last 10 exchanges)
        if history:
            messages.extend(history[-20:])

        # Build user message with context
        if context:
            full_user_message = f"{context}\n\nUSER QUESTION: {user_message}"
        else:
            full_user_message = user_message

        messages.append({"role": "user", "content": full_user_message})
        return messages

    async def generate_stream(
        self,
        user_message: str,
        context: str = "",
        history: Optional[List[dict]] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream LLM response tokens."""
        messages = self.build_messages(user_message, context, history)

        try:
            stream = self.client.chat(
                model=self.model,
                messages=messages,
                stream=True,
                options={
                    "temperature": 0.7,
                    "num_predict": 2048,
                },
            )

            for chunk in stream:
                if chunk.get("message", {}).get("content"):
                    yield chunk["message"]["content"]

        except Exception as e:
            logger.error(f"LLM streaming failed: {e}")
            yield f"\n\n[Error: {str(e)}]"

    async def generate(
        self,
        prompt: str,
        system: str = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> str:
        """Generate a non-streaming response."""
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        try:
            response = self.client.chat(
                model=self.model,
                messages=messages,
                stream=False,
                options={
                    "temperature": temperature,
                    "num_predict": max_tokens,
                },
            )
            return response["message"]["content"]
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            raise
