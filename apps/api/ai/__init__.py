"""AI provider adapter — chat + embed for all of apps/api."""

from ai.budget import daily_budget, used_neurons_today
from ai.embed import embed_text
from ai.errors import ProviderError, ProviderNotImplementedError
from ai.factory import get_provider
from ai.types import (
    EMBED_DIMS,
    ChatMessage,
    ChatResult,
    EmbedResult,
)

__all__ = [
    "EMBED_DIMS",
    "ChatMessage",
    "ChatResult",
    "EmbedResult",
    "ProviderError",
    "ProviderNotImplementedError",
    "daily_budget",
    "embed_text",
    "get_provider",
    "used_neurons_today",
]
