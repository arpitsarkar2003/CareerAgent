"""Stable Module 2 embed facade — delegates to the provider adapter."""

from __future__ import annotations

from ai.errors import ProviderError
from ai.factory import get_provider
from ai.types import EMBED_DIMS
from errors import AppError

# Re-export for callers / tests that historically imported these constants.
DEFAULT_EMBED_MODEL = "@cf/baai/bge-large-en-v1.5"
MAX_EMBED_CHARS = 2000


async def embed_text(text: str) -> list[float]:
    """Embed a single string; returns a 1024-dim vector via the active provider.

    Preserves the Module 2 call signature used by ``services.knowledge``.
    Provider failures are mapped to ``AppError`` so existing HTTP handlers
    keep working without changes.
    """
    try:
        result = await get_provider().embed(text)
    except ProviderError as exc:
        if exc.status_code == 429:
            code = "ai_budget_exceeded"
        elif exc.status_code == 500:
            code = "embed_misconfigured"
        elif exc.status_code == 400:
            code = "validation_error"
        else:
            code = "embed_failed"
        raise AppError(code, exc.message, status_code=exc.status_code) from None

    if len(result.vector) != EMBED_DIMS:
        raise AppError(
            "embed_failed",
            f"Expected {EMBED_DIMS}-dim embedding, got {len(result.vector)}",
            status_code=502,
        )
    return result.vector
