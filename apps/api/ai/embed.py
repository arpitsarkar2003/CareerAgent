"""Narrow embedding call — Cloudflare Workers AI (free tier). Module 3 may replace."""

from __future__ import annotations

import os
from urllib.parse import quote

import httpx

from errors import AppError

# Locked to 1024 dims for @cf/baai/bge-large-en-v1.5 (DATA_MODEL).
DEFAULT_EMBED_MODEL = "@cf/baai/bge-large-en-v1.5"
EMBED_DIMS = 1024
# bge-large context is 512 tokens — keep payload short.
MAX_EMBED_CHARS = 2000


def _embed_model() -> str:
    return (
        os.environ.get("EMBEDDING_MODEL", DEFAULT_EMBED_MODEL).strip()
        or DEFAULT_EMBED_MODEL
    )


async def embed_text(text: str) -> list[float]:
    """Embed a single string; returns a 1024-dim vector via Cloudflare Workers AI."""
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
    api_token = (
        os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
        or os.environ.get("CLOUDFLARE_AUTH_TOKEN", "").strip()
    )
    if not account_id or not api_token:
        raise AppError(
            "embed_misconfigured",
            "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set",
            status_code=500,
        )

    cleaned = (text or "").strip()
    if not cleaned:
        raise AppError(
            "validation_error",
            "Cannot embed empty text",
            status_code=400,
        )
    if len(cleaned) > MAX_EMBED_CHARS:
        cleaned = cleaned[:MAX_EMBED_CHARS]

    model = _embed_model()
    # Workers AI run endpoint — free-tier Cloudflare-hosted embeddings.
    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{account_id}"
        f"/ai/run/{quote(model, safe='@/')}"
    )
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
    }
    payload = {"text": [cleaned]}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        raise AppError(
            "embed_failed",
            f"Embedding request failed: {exc}",
            status_code=502,
        ) from None

    if res.status_code >= 400:
        detail = res.text[:200] if res.text else ""
        raise AppError(
            "embed_failed",
            f"Embedding provider returned {res.status_code}"
            + (f": {detail}" if detail else ""),
            status_code=502,
        )

    body = res.json()
    vector = _extract_vector(body)

    if not isinstance(vector, list) or len(vector) != EMBED_DIMS:
        raise AppError(
            "embed_failed",
            f"Expected {EMBED_DIMS}-dim embedding, got "
            f"{len(vector) if isinstance(vector, list) else 'invalid'}",
            status_code=502,
        )

    return [float(x) for x in vector]


def _extract_vector(body: object) -> list[float]:
    """Parse Cloudflare Workers AI / OpenAI-compatible embedding responses."""
    if not isinstance(body, dict):
        raise AppError(
            "embed_failed",
            "Unexpected embedding response shape",
            status_code=502,
        ) from None

    # Standard Workers AI: { success, result: { data: [[...]], shape: [...] } }
    result = body.get("result", body)
    if isinstance(result, dict):
        data = result.get("data")
        if isinstance(data, list) and data:
            first = data[0]
            if isinstance(first, list):
                return first
            if isinstance(first, dict) and "embedding" in first:
                return first["embedding"]

        # Some responses nest under result.embedding
        emb = result.get("embedding")
        if isinstance(emb, list):
            return emb

    # OpenAI-compatible: { data: [{ embedding: [...] }] }
    data = body.get("data")
    if isinstance(data, list) and data and isinstance(data[0], dict):
        emb = data[0].get("embedding")
        if isinstance(emb, list):
            return emb

    raise AppError(
        "embed_failed",
        "Unexpected embedding response shape",
        status_code=502,
    ) from None
