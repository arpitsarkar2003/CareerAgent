"""Cloudflare Workers AI adapter — chat + embed."""

from __future__ import annotations

import logging
import os
from urllib.parse import quote

import httpx

from ai.budget import check_budget, record_usage
from ai.errors import ProviderError, TransientProviderError
from ai.retry import with_retry
from ai.types import (
    EMBED_DIMS,
    ChatMessage,
    ChatResult,
    EmbedResult,
)

logger = logging.getLogger(__name__)

PROVIDER_NAME = "cloudflare"
DEFAULT_CHAT_MODEL = "@cf/zai-org/glm-4.7-flash"
DEFAULT_EMBED_MODEL = "@cf/baai/bge-large-en-v1.5"
MAX_EMBED_CHARS = 2000
REQUEST_TIMEOUT_S = 60.0

# HTTP statuses treated as transient (retryable). 401 included so a bad
# token surfaces as retry-then-typed-error (Module 3 acceptance), not a
# one-shot hang/silent failure.
_TRANSIENT_STATUS = frozenset({401, 408, 429, 500, 502, 503, 504})


def _chat_model_default() -> str:
    return (
        os.environ.get("CHAT_MODEL", DEFAULT_CHAT_MODEL).strip()
        or DEFAULT_CHAT_MODEL
    )


def _embed_model_default() -> str:
    return (
        os.environ.get("EMBEDDING_MODEL", DEFAULT_EMBED_MODEL).strip()
        or DEFAULT_EMBED_MODEL
    )


def _credentials(*, capability: str) -> tuple[str, str]:
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
    api_token = (
        os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
        or os.environ.get("CLOUDFLARE_AUTH_TOKEN", "").strip()
    )
    if not account_id or not api_token:
        raise ProviderError(
            capability=capability,  # type: ignore[arg-type]
            provider=PROVIDER_NAME,
            message=(
                "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set"
            ),
            status_code=500,
        )
    return account_id, api_token


def _run_url(account_id: str, model: str) -> str:
    return (
        f"https://api.cloudflare.com/client/v4/accounts/{account_id}"
        f"/ai/run/{quote(model, safe='@/')}"
    )


def _log_usage(
    *,
    capability: str,
    model: str,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    total_tokens: int | None = None,
) -> None:
    logger.info(
        "ai_usage provider=%s capability=%s model=%s "
        "prompt_tokens=%s completion_tokens=%s total_tokens=%s",
        PROVIDER_NAME,
        capability,
        model,
        prompt_tokens,
        completion_tokens,
        total_tokens,
    )
    record_usage(
        capability=capability,  # type: ignore[arg-type]
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
    )


def _extract_usage(body: dict) -> tuple[int | None, int | None, int | None]:
    usage = body.get("usage")
    if not isinstance(usage, dict):
        result = body.get("result")
        if isinstance(result, dict):
            usage = result.get("usage")
    if not isinstance(usage, dict):
        return None, None, None

    prompt = usage.get("prompt_tokens") or usage.get("prompt_token_count")
    completion = usage.get("completion_tokens") or usage.get(
        "completion_token_count"
    )
    total = usage.get("total_tokens") or usage.get("total_token_count")
    return (
        int(prompt) if isinstance(prompt, (int, float)) else None,
        int(completion) if isinstance(completion, (int, float)) else None,
        int(total) if isinstance(total, (int, float)) else None,
    )


def _message_content(msg: object) -> str | None:
    if not isinstance(msg, dict):
        return None
    content = msg.get("content")
    if isinstance(content, str) and content.strip():
        return content.strip()
    return None


def _extract_chat_text(body: object) -> str:
    if not isinstance(body, dict):
        raise TransientProviderError("Unexpected chat response shape")

    candidates: list[dict] = []
    # Top-level OpenAI shape
    top_choices = body.get("choices")
    if isinstance(top_choices, list):
        candidates.extend(c for c in top_choices if isinstance(c, dict))

    result = body.get("result", body)
    if isinstance(result, dict):
        for key in ("response", "text", "output"):
            val = result.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
        nested = result.get("choices")
        if isinstance(nested, list):
            candidates.extend(c for c in nested if isinstance(c, dict))
        # Direct message on result
        direct = _message_content(result.get("message"))
        if direct:
            return direct
    elif isinstance(result, str) and result.strip():
        return result.strip()

    truncated = False
    for choice in candidates:
        text = _message_content(choice.get("message"))
        if text:
            return text
        if isinstance(choice.get("text"), str) and choice["text"].strip():
            return choice["text"].strip()
        if choice.get("finish_reason") == "length":
            truncated = True

    if truncated:
        raise ProviderError(
            capability="chat",
            provider=PROVIDER_NAME,
            message=(
                "Chat response truncated before content "
                "(increase max_tokens)"
            ),
        )

    raise ProviderError(
        capability="chat",
        provider=PROVIDER_NAME,
        message="Empty or unparseable chat response",
    )


def _extract_vector(body: object) -> list[float]:
    if not isinstance(body, dict):
        raise TransientProviderError("Unexpected embedding response shape")

    result = body.get("result", body)
    if isinstance(result, dict):
        data = result.get("data")
        if isinstance(data, list) and data:
            first = data[0]
            if isinstance(first, list):
                return first
            if isinstance(first, dict) and "embedding" in first:
                emb = first["embedding"]
                if isinstance(emb, list):
                    return emb
        emb = result.get("embedding")
        if isinstance(emb, list):
            return emb

    data = body.get("data")
    if isinstance(data, list) and data and isinstance(data[0], dict):
        emb = data[0].get("embedding")
        if isinstance(emb, list):
            return emb

    raise TransientProviderError("Unexpected embedding response shape")


async def _post_json(
    *,
    url: str,
    headers: dict[str, str],
    payload: dict,
    capability: str,
) -> dict:
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as client:
            res = await client.post(url, headers=headers, json=payload)
    except httpx.TimeoutException as exc:
        raise TransientProviderError(f"timeout: {exc}") from None
    except httpx.HTTPError as exc:
        raise TransientProviderError(f"network error: {exc}") from None

    if res.status_code in _TRANSIENT_STATUS:
        detail = (res.text or "")[:200]
        raise TransientProviderError(
            f"HTTP {res.status_code}" + (f": {detail}" if detail else "")
        )

    if res.status_code >= 400:
        detail = (res.text or "")[:200]
        raise ProviderError(
            capability=capability,  # type: ignore[arg-type]
            provider=PROVIDER_NAME,
            message=(
                f"HTTP {res.status_code}"
                + (f": {detail}" if detail else "")
            ),
        )

    try:
        body = res.json()
    except ValueError as exc:
        raise TransientProviderError(f"invalid JSON: {exc}") from None

    if not isinstance(body, dict):
        raise TransientProviderError("response is not a JSON object")

    # Cloudflare envelope may set success=false with errors.
    if body.get("success") is False:
        errors = body.get("errors")
        msg = str(errors)[:200] if errors else "Cloudflare reported success=false"
        # Auth / quota style failures are not always transient; still retry
        # once-class errors that look rate-limity via HTTP status above.
        raise ProviderError(
            capability=capability,  # type: ignore[arg-type]
            provider=PROVIDER_NAME,
            message=msg,
        )

    return body


class CloudflareAdapter:
    """Workers AI implementation of the AIProvider protocol."""

    name = PROVIDER_NAME

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> ChatResult:
        if not messages:
            raise ProviderError(
                capability="chat",
                provider=PROVIDER_NAME,
                message="messages must be non-empty",
                status_code=400,
            )

        account_id, api_token = _credentials(capability="chat")
        resolved_model = (model or "").strip() or _chat_model_default()
        url = _run_url(account_id, resolved_model)
        headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        }
        payload: dict = {
            "messages": [
                {"role": m.role, "content": m.content} for m in messages
            ]
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        if temperature is not None:
            payload["temperature"] = temperature

        check_budget(capability="chat")

        async def _once() -> ChatResult:
            body = await _post_json(
                url=url,
                headers=headers,
                payload=payload,
                capability="chat",
            )
            text = _extract_chat_text(body)
            prompt_t, completion_t, total_t = _extract_usage(body)
            _log_usage(
                capability="chat",
                model=resolved_model,
                prompt_tokens=prompt_t,
                completion_tokens=completion_t,
                total_tokens=total_t,
            )
            return ChatResult(
                text=text,
                provider=PROVIDER_NAME,
                model=resolved_model,
                prompt_tokens=prompt_t,
                completion_tokens=completion_t,
                total_tokens=total_t,
            )

        return await with_retry(
            _once, capability="chat", provider=PROVIDER_NAME
        )

    async def embed(self, text: str) -> EmbedResult:
        cleaned = (text or "").strip()
        if not cleaned:
            raise ProviderError(
                capability="embed",
                provider=PROVIDER_NAME,
                message="Cannot embed empty text",
                status_code=400,
            )
        if len(cleaned) > MAX_EMBED_CHARS:
            cleaned = cleaned[:MAX_EMBED_CHARS]

        account_id, api_token = _credentials(capability="embed")
        resolved_model = _embed_model_default()
        url = _run_url(account_id, resolved_model)
        headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        }
        payload = {"text": [cleaned]}

        check_budget(capability="embed")

        async def _once() -> EmbedResult:
            body = await _post_json(
                url=url,
                headers=headers,
                payload=payload,
                capability="embed",
            )
            vector = _extract_vector(body)
            if not isinstance(vector, list) or len(vector) != EMBED_DIMS:
                raise ProviderError(
                    capability="embed",
                    provider=PROVIDER_NAME,
                    message=(
                        f"Expected {EMBED_DIMS}-dim embedding, got "
                        f"{len(vector) if isinstance(vector, list) else 'invalid'}"
                    ),
                )
            prompt_t, _, total_t = _extract_usage(body)
            _log_usage(
                capability="embed",
                model=resolved_model,
                prompt_tokens=prompt_t,
                total_tokens=total_t,
            )
            return EmbedResult(
                vector=[float(x) for x in vector],
                provider=PROVIDER_NAME,
                model=resolved_model,
                prompt_tokens=prompt_t,
                total_tokens=total_t,
            )

        return await with_retry(
            _once, capability="embed", provider=PROVIDER_NAME
        )
