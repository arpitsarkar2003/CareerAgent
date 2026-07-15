"""Retry / backoff for transient AI provider failures."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import TypeVar

from ai.errors import ProviderError, TransientProviderError
from ai.types import Capability

logger = logging.getLogger(__name__)

T = TypeVar("T")

DEFAULT_MAX_ATTEMPTS = 3
DEFAULT_BASE_DELAY_S = 0.5


async def with_retry(
    fn: Callable[[], Awaitable[T]],
    *,
    capability: Capability,
    provider: str,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
    base_delay_s: float = DEFAULT_BASE_DELAY_S,
) -> T:
    """Run ``fn`` with exponential backoff on TransientProviderError."""
    last_message = "unknown transient failure"
    for attempt in range(1, max_attempts + 1):
        try:
            return await fn()
        except TransientProviderError as exc:
            last_message = exc.message
            if attempt >= max_attempts:
                break
            delay = base_delay_s * (2 ** (attempt - 1))
            logger.warning(
                "ai_retry provider=%s capability=%s attempt=%s/%s delay=%.2fs error=%s",
                provider,
                capability,
                attempt,
                max_attempts,
                delay,
                last_message,
            )
            await asyncio.sleep(delay)
        except ProviderError:
            raise

    raise ProviderError(
        capability=capability,
        provider=provider,
        message=f"failed after {max_attempts} attempts: {last_message}",
    )
