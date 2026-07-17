"""Module 5 — scoring service.

One chat call per posting, judged against a resume-only profile summary.
This module is the single call site for scoring: both the post-search
client loop and the standalone per-posting retry endpoint call
``score_posting`` — no scoring logic duplicated between them, per
docs/modules/05-scoring.md.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from ai import ChatMessage, ProviderError, get_provider
from db import get_supabase
from errors import NotFoundError, ValidationAppError
from services.job_postings import public_posting_row

logger = logging.getLogger(__name__)

# Keeps each scoring call small/fast per the locked "condensed profile
# summary" decision — not the full knowledge base.
MAX_PROFILE_CHARS = 14_000
MAX_POSTING_CHARS = 8_000
CHAT_MAX_TOKENS = 800

_SYSTEM_PROMPT = (
    "You are a job-fit scoring assistant for a single job seeker. You are "
    "given the candidate's resume-derived profile and one job posting's "
    "text. Judge fit semantically — skills, location, and experience level "
    "— never keyword-match alone. Be concise: at most 6 items in each "
    "skills list, and at most one short sentence for each fit note. "
    "Respond with ONLY one JSON object — no markdown fences, no "
    "preamble, no commentary before or after it — matching exactly this "
    'shape: {"score": <integer 0-100>, "skills_matched": [<strings>], '
    '"skills_missing": [<strings>], "location_fit": <one short sentence>, '
    '"experience_fit": <one short sentence>}'
)


def build_profile_summary(user_id: str) -> str:
    """Condensed profile context built from ``resume``-type chunks only.

    Cover letters, projects, and notes are intentionally excluded — they
    matter for drafting (Module 7), not this skills/location/experience
    match. Rebuilt fresh on every call (never cached) so knowledge-base
    edits are always reflected immediately.
    """
    sb = get_supabase()
    result = (
        sb.table("knowledge_chunks")
        .select("content,created_at")
        .eq("user_id", user_id)
        .eq("source_type", "resume")
        .order("created_at", desc=False)
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise ValidationAppError(
            "No resume knowledge chunks found — upload a resume before scoring"
        )

    parts: list[str] = []
    total = 0
    for row in rows:
        content = (row.get("content") or "").strip()
        if not content:
            continue
        remaining = MAX_PROFILE_CHARS - total
        if remaining <= 0:
            break
        if len(content) > remaining:
            content = content[:remaining]
        parts.append(content)
        total += len(content)

    summary = "\n\n".join(parts).strip()
    if not summary:
        raise ValidationAppError(
            "Resume knowledge chunks are empty — upload a resume before scoring"
        )
    return summary


def _extract_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    candidate = match.group(0) if match else cleaned
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise ProviderError(
            capability="chat",
            provider="cloudflare",
            message=f"Could not parse scoring response as JSON: {exc}",
        ) from None
    if not isinstance(parsed, dict):
        raise ProviderError(
            capability="chat",
            provider="cloudflare",
            message="Scoring response was not a JSON object",
        )
    return parsed


def _str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v).strip() for v in value if str(v).strip()]


def _coerce_score_and_reasoning(parsed: dict[str, Any]) -> tuple[float, dict[str, Any]]:
    raw_score = parsed.get("score")
    try:
        score = float(raw_score)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        raise ProviderError(
            capability="chat",
            provider="cloudflare",
            message=f"Scoring response missing a numeric score: {raw_score!r}",
        ) from None
    score = max(0.0, min(100.0, score))

    reasoning = {
        "skills_matched": _str_list(parsed.get("skills_matched")),
        "skills_missing": _str_list(parsed.get("skills_missing")),
        "location_fit": str(parsed.get("location_fit") or "").strip(),
        "experience_fit": str(parsed.get("experience_fit") or "").strip(),
    }
    return score, reasoning


async def score_posting(user_id: str, posting_id: str) -> dict[str, Any]:
    """Score one posting: profile + posting -> one chat call -> parsed write.

    Raises ``NotFoundError`` if the posting doesn't belong to this user.
    Raises ``ProviderError`` (from the AI adapter after its own retries, or
    raised here when the response can't be parsed) if scoring fails —
    callers (the post-search loop, the retry route) must catch this and
    isolate it from sibling postings rather than let it abort a batch.
    """
    sb = get_supabase()
    existing = (
        sb.table("job_postings")
        .select("id,raw_text,company,title")
        .eq("id", posting_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = existing.data or []
    if not rows:
        raise NotFoundError("Job posting not found")
    posting = rows[0]

    profile = build_profile_summary(user_id)
    raw_text = (posting.get("raw_text") or "").strip()[:MAX_POSTING_CHARS]

    user_message = (
        "CANDIDATE PROFILE (resume-derived):\n"
        f"{profile}\n\n"
        "JOB POSTING:\n"
        f"Company: {posting.get('company')}\n"
        f"Title: {posting.get('title')}\n"
        f"{raw_text}"
    )

    provider = get_provider()
    result = await provider.chat(
        [
            ChatMessage(role="system", content=_SYSTEM_PROMPT),
            ChatMessage(role="user", content=user_message),
        ],
        max_tokens=CHAT_MAX_TOKENS,
        temperature=0.2,
    )

    parsed = _extract_json_object(result.text)
    score, reasoning = _coerce_score_and_reasoning(parsed)

    updated = (
        sb.table("job_postings")
        .update({"score": score, "score_reasoning": reasoning})
        .eq("id", posting_id)
        .eq("user_id", user_id)
        .select("*")
        .execute()
    )
    if not updated.data:
        raise NotFoundError("Job posting not found")

    logger.info(
        "posting_scored user_id=%s posting_id=%s score=%.0f",
        user_id,
        posting_id,
        score,
    )
    return public_posting_row(updated.data[0])
