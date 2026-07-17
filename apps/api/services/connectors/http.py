"""Shared rate-limit-aware HTTP helpers for job-board connectors."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_S = 30.0
MAX_ATTEMPTS = 3
BASE_DELAY_S = 1.0
DEFAULT_HEADERS = {
    "User-Agent": "CareerAgent/1.0 (+https://github.com/local/career-agent; job-board search)",
    "Accept": "application/json",
}


class ConnectorHttpError(Exception):
    """Non-retriable or exhausted HTTP failure for one connector request."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        rate_limited: bool = False,
    ) -> None:
        self.message = message
        self.status_code = status_code
        self.rate_limited = rate_limited
        super().__init__(message)


async def get_json(
    client: httpx.AsyncClient,
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> Any:
    """GET JSON with bounded retries on 429 / 5xx / transport errors."""
    last_message = "request failed"
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            merged = {**DEFAULT_HEADERS, **(headers or {})}
            response = await client.get(url, params=params, headers=merged)
        except httpx.TimeoutException as exc:
            last_message = f"timeout fetching {url}"
            if attempt >= MAX_ATTEMPTS:
                raise ConnectorHttpError(last_message) from exc
            await asyncio.sleep(BASE_DELAY_S * (2 ** (attempt - 1)))
            continue
        except httpx.HTTPError as exc:
            last_message = f"network error fetching {url}: {exc}"
            if attempt >= MAX_ATTEMPTS:
                raise ConnectorHttpError(last_message) from exc
            await asyncio.sleep(BASE_DELAY_S * (2 ** (attempt - 1)))
            continue

        if response.status_code == 429:
            last_message = f"rate limited by {url}"
            retry_after = response.headers.get("Retry-After")
            delay = BASE_DELAY_S * (2 ** (attempt - 1))
            if retry_after:
                try:
                    delay = max(delay, float(retry_after))
                except ValueError:
                    pass
            if attempt >= MAX_ATTEMPTS:
                raise ConnectorHttpError(
                    last_message, status_code=429, rate_limited=True
                )
            logger.warning(
                "connector_rate_limit url=%s attempt=%s delay=%.2fs",
                url,
                attempt,
                delay,
            )
            await asyncio.sleep(delay)
            continue

        if response.status_code >= 500:
            last_message = f"server error {response.status_code} from {url}"
            if attempt >= MAX_ATTEMPTS:
                raise ConnectorHttpError(
                    last_message, status_code=response.status_code
                )
            await asyncio.sleep(BASE_DELAY_S * (2 ** (attempt - 1)))
            continue

        if response.status_code >= 400:
            raise ConnectorHttpError(
                f"HTTP {response.status_code} from {url}: {response.text[:200]}",
                status_code=response.status_code,
            )

        try:
            return response.json()
        except ValueError as exc:
            raise ConnectorHttpError(f"invalid JSON from {url}") from exc

    raise ConnectorHttpError(last_message)
