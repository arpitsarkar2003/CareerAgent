"""Ashby Job Board API connector.

Public API: GET https://api.ashbyhq.com/posting-api/job-board/{boardName}
Docs: https://developers.ashbyhq.com/docs/public-job-posting-api

Dedupe key: prefer jobUrl; fallback external_id = job id / jobPostingId.
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

BASE = "https://api.ashbyhq.com/posting-api/job-board"


def _strip_html(value: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", value)
    text = re.sub(r"(?s)<br\s*/?>", "\n", text)
    text = re.sub(r"(?s)</p>", "\n\n", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"[ \t]+\n", "\n", re.sub(r"[ \t]{2,}", " ", text)).strip()


def _location_text(job: dict[str, Any]) -> str:
    loc = job.get("location")
    if isinstance(loc, str) and loc.strip():
        return loc.strip()
    if isinstance(loc, dict):
        return str(loc.get("name") or loc.get("location") or "")
    # secondaryLocations may be a list of strings or objects
    secondary = job.get("secondaryLocations") or []
    if isinstance(secondary, list) and secondary:
        names: list[str] = []
        for item in secondary:
            if isinstance(item, str):
                names.append(item)
            elif isinstance(item, dict):
                names.append(str(item.get("location") or item.get("name") or ""))
        return ", ".join(n for n in names if n)
    return ""


def _description_text(job: dict[str, Any]) -> str:
    for key in ("descriptionPlain", "descriptionHtml", "description"):
        val = job.get(key)
        if isinstance(val, str) and val.strip():
            if key.endswith("Plain"):
                return val.strip()
            return _strip_html(val)
    return ""


def _normalize_job(job: dict[str, Any], *, board_name: str) -> NormalizedPosting | None:
    title = str(job.get("title") or "").strip()
    if not title:
        return None

    external_id = (
        str(job.get("id") or job.get("jobId") or job.get("jobPostingId") or "").strip()
        or None
    )
    url_val = job.get("jobUrl") or job.get("applyUrl") or job.get("url")
    url = str(url_val).strip() if url_val else None

    # Ashby board slug is the company career site; department/team are separate.
    company = str(job.get("companyName") or board_name).strip() or board_name

    location = _location_text(job)
    team = str(job.get("team") or "")
    department = str(job.get("department") or "")
    employment = str(job.get("employmentType") or "")

    parts = [
        title,
        f"Company: {company}",
        f"Location: {location}" if location else "",
        f"Team: {team}" if team else "",
        f"Department: {department}" if department else "",
        f"Employment: {employment}" if employment else "",
        _description_text(job),
    ]
    raw_text = "\n".join(p for p in parts if p).strip() or title

    return NormalizedPosting(
        company=company,
        title=title,
        url=url,
        raw_text=raw_text,
        source="ashby",
        external_id=external_id,
    )


async def fetch_board(
    client: httpx.AsyncClient,
    board_name: str,
) -> list[NormalizedPosting]:
    name = board_name.strip()
    if not name:
        return []
    data = await get_json(
        client,
        f"{BASE}/{name}",
        params={"includeCompensation": "true"},
    )
    jobs = data.get("jobs") if isinstance(data, dict) else None
    if not isinstance(jobs, list):
        return []

    # Board-level company name if present
    board_company = ""
    if isinstance(data, dict):
        board_company = str(data.get("apiKeyLabel") or data.get("name") or name)

    out: list[NormalizedPosting] = []
    for job in jobs:
        if not isinstance(job, dict):
            continue
        if board_company and not job.get("companyName"):
            job = {**job, "companyName": board_company}
        posting = _normalize_job(job, board_name=name)
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
                source="ashby",
                status="skipped",
                message="No Ashby boards configured",
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
            logger.warning("ashby_board_failed board=%s error=%s", board, exc.message)

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
            source="ashby",
            status=status,
            fetched=len(collected),
            matched=len(matched),
            message=message,
        ),
        matched,
    )
