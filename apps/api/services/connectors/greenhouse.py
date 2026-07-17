"""Greenhouse Job Board API connector.

Public API: GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs
Docs: https://developers.greenhouse.io/job-board.html

Dedupe key: prefer absolute job URL; fallback external_id = str(job.id).
"""

from __future__ import annotations

import html
import logging
import re
from typing import Any

import httpx

from services.connectors.filters import filter_postings
from services.connectors.http import ConnectorHttpError, get_json
from services.connectors.types import ConnectorResult, NormalizedPosting

logger = logging.getLogger(__name__)

BASE = "https://boards-api.greenhouse.io/v1/boards"


def _strip_html(value: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", value)
    text = re.sub(r"(?s)<br\s*/?>", "\n", text)
    text = re.sub(r"(?s)</p>", "\n\n", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"[ \t]+\n", "\n", re.sub(r"[ \t]{2,}", " ", text)).strip()


def _location_text(job: dict[str, Any]) -> str:
    loc = job.get("location") or {}
    if isinstance(loc, dict):
        return str(loc.get("name") or "")
    return str(loc or "")


def _normalize_job(job: dict[str, Any], *, board_token: str) -> NormalizedPosting | None:
    title = str(job.get("title") or "").strip()
    if not title:
        return None

    job_id = job.get("id")
    external_id = str(job_id) if job_id is not None else None
    absolute_url = job.get("absolute_url")
    url = str(absolute_url).strip() if absolute_url else None
    if not url and external_id:
        url = f"https://boards.greenhouse.io/{board_token}/jobs/{external_id}"

    company = str(
        (job.get("company_name") or board_token or "Unknown")
    ).strip() or board_token

    content = job.get("content") or ""
    location = _location_text(job)
    departments = job.get("departments") or []
    dept_names = [
        str(d.get("name"))
        for d in departments
        if isinstance(d, dict) and d.get("name")
    ]
    parts = [
        title,
        f"Company: {company}",
        f"Location: {location}" if location else "",
        f"Departments: {', '.join(dept_names)}" if dept_names else "",
        _strip_html(str(content)) if content else "",
    ]
    raw_text = "\n".join(p for p in parts if p).strip()
    if not raw_text:
        raw_text = title

    return NormalizedPosting(
        company=company,
        title=title,
        url=url,
        raw_text=raw_text,
        source="greenhouse",
        external_id=external_id,
    )


async def fetch_board(
    client: httpx.AsyncClient,
    board_token: str,
) -> list[NormalizedPosting]:
    token = board_token.strip()
    if not token:
        return []
    data = await get_json(
        client,
        f"{BASE}/{token}/jobs",
        params={"content": "true"},
    )
    jobs = data.get("jobs") if isinstance(data, dict) else None
    if not isinstance(jobs, list):
        return []

    out: list[NormalizedPosting] = []
    for job in jobs:
        if not isinstance(job, dict):
            continue
        posting = _normalize_job(job, board_token=token)
        if posting is not None:
            out.append(posting)
    return out


async def run(
    client: httpx.AsyncClient,
    *,
    boards: list[str],
    role_keywords: list[str],
    locations: list[str],
    experience_levels: list[str],
) -> tuple[ConnectorResult, list[NormalizedPosting]]:
    if not boards:
        return (
            ConnectorResult(
                source="greenhouse",
                status="skipped",
                message="No Greenhouse boards configured",
            ),
            [],
        )

    collected: list[NormalizedPosting] = []
    errors: list[str] = []
    rate_limited = False

    for board in boards:
        try:
            collected.extend(await fetch_board(client, board))
        except ConnectorHttpError as exc:
            errors.append(f"{board}: {exc.message}")
            rate_limited = rate_limited or exc.rate_limited
            logger.warning("greenhouse_board_failed board=%s error=%s", board, exc.message)

    matched = filter_postings(
        collected,
        role_keywords=role_keywords,
        locations=locations,
        experience_levels=experience_levels,
    )

    if errors and not collected:
        status = "failed"
        message = "; ".join(errors)
        if rate_limited:
            message = f"Rate limited. {message}"
    elif errors:
        status = "partial"
        message = "; ".join(errors)
    else:
        status = "success"
        message = None

    return (
        ConnectorResult(
            source="greenhouse",
            status=status,
            fetched=len(collected),
            matched=len(matched),
            message=message,
        ),
        matched,
    )
