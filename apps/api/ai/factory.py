"""Env-driven AI provider selection."""

from __future__ import annotations

import os

from ai.cloudflare import CloudflareAdapter
from ai.errors import ProviderNotImplementedError
from ai.types import AIProvider

DEFAULT_PROVIDER = "cloudflare"


def get_provider() -> AIProvider:
    """Return the active AI provider adapter.

    ``AI_PROVIDER`` defaults to ``cloudflare``. Unknown values raise a clear
    ``ProviderNotImplementedError`` rather than crashing.
    """
    name = (
        os.environ.get("AI_PROVIDER", DEFAULT_PROVIDER).strip().lower()
        or DEFAULT_PROVIDER
    )
    if name == "cloudflare":
        return CloudflareAdapter()
    raise ProviderNotImplementedError(name)
