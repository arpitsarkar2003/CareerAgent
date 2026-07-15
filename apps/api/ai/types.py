"""Provider-agnostic AI adapter types and protocol."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Protocol

# Locked to 1024 dims for @cf/baai/bge-large-en-v1.5 (DATA_MODEL).
EMBED_DIMS = 1024

ChatRole = Literal["system", "user", "assistant"]
Capability = Literal["chat", "embed"]


@dataclass(frozen=True)
class ChatMessage:
    role: ChatRole
    content: str


@dataclass(frozen=True)
class ChatResult:
    text: str
    provider: str
    model: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None


@dataclass(frozen=True)
class EmbedResult:
    vector: list[float]
    provider: str
    model: str
    prompt_tokens: int | None = None
    total_tokens: int | None = None


class AIProvider(Protocol):
    """Single seam for chat + embed. Callers never import a concrete SDK."""

    name: str

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> ChatResult: ...

    async def embed(self, text: str) -> EmbedResult: ...
