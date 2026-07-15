"""Typed AI provider failures."""

from __future__ import annotations

from ai.types import Capability


class ProviderError(Exception):
    """Raised after retries are exhausted, or on non-retryable provider failure."""

    def __init__(
        self,
        *,
        capability: Capability,
        provider: str,
        message: str,
        status_code: int = 502,
    ) -> None:
        self.capability = capability
        self.provider = provider
        self.message = message
        self.status_code = status_code
        super().__init__(
            f"{provider}/{capability} failed: {message}"
        )


class ProviderNotImplementedError(ProviderError):
    """AI_PROVIDER points at a provider with no adapter implementation yet."""

    def __init__(self, provider: str) -> None:
        super().__init__(
            capability="chat",
            provider=provider,
            message=f"provider not implemented: {provider}",
            status_code=501,
        )
        # Override capability-agnostic wording for the seam check.
        self.message = f"provider not implemented: {provider}"
        Exception.__init__(self, self.message)


class TransientProviderError(Exception):
    """Internal signal that a call should be retried."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)
