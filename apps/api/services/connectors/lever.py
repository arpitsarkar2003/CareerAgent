"""Lever Postings API connector.

Public API: GET https://api.lever.co/v0/postings/{company}?mode=json
Docs: https://github.com/lever/postings-api

Dedupe key: prefer hostedUrl / applyUrl; fallback external_id = posting id.
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

BASE = "https://api.lever.co/v0/postings"
PAGE_SIZE = 100


def _strip_html(value: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", value)
    text = re.sub(r"(?s)<br\s*/?>", "\n", text)
    text = re.sub(r"(?s)</p>", "\n\n", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"[ \t]+\n", "\n", re.sub(r"[ \t]{2,}", " ", text)).strip()


def _location_text(job: dict[str, Any]) -> str:
    """Lever nests location under categories.location (string) or categories.commitment."""
    categories = job.get("categories") or {}
    if isinstance(categories, dict):
        loc = categories.get("location")
        if isinstance(loc, str) and loc.strip():
            return loc.strip()
        # Some boards expose allLocations as a list.
        all_locs = categories.get("allLocations") or job.get("allLocations")
        if isinstance(all_locs, list):
            return ", ".join(str(x) for x in all_locs if x)
    # Legacy / alternate shapes
    loc = job.get("location")
    if isinstance(loc, dict):
        return str(loc.get("name") or "")
    if isinstance(loc, str):
        return loc
    return ""


def _description_text(job: dict[str, Any]) -> str:
    for key in ("descriptionPlain", "description", "additionalPlain", "additional"):
        val = job.get(key)
        if isinstance(val, str) and val.strip():
            if "Plain" in key:
                return val.strip()
            return _strip_html(val)
    # lists of sections
    lists = job.get("lists")
    if isinstance(lists, list):
        chunks: list[str] = []
        for section in lists:
            if not isinstance(section, dict):
                continue
            text = section.get("text") or section.get("content")
            if text:
                chunks.append(_strip_html(str(text)))
        if chunks:
            return "\n\n".join(chunks)
    return ""


def _normalize_job(job: dict[str, Any], *, company_slug: str) -> NormalizedPosting | None:
    title = str(job.get("text") or job.get("title") or "").strip()
    if not title:
        return None

    external_id = str(job.get("id") or "").strip() or None
    url_val = job.get("hostedUrl") or job.get("applyUrl") or job.get("url")
    url = str(url_val).strip() if url_val else None
    if not url and external_id:
        url = f"https://jobs.lever.co/{company_slug}/{external_id}"

    company = str(job.get("company") or company_slug).strip() or company_slug
    location = _location_text(job)
    categories = job.get("categories") or {}
    commitment = ""
    team = ""
    if isinstance(categories, dict):
        commitment = str(categories.get("commitment") or "")
        team = str(categories.get("team") or "")

    parts = [
        title,
        f"Company: {company}",
        f"Location: {location}" if location else "",
        f"Team: {team}" if team else "",
        f"Commitment: {commitment}" if commitment else "",
        _description_text(job),
    ]
    raw_text = "\n".join(p for p in parts if p).strip() or title

    return NormalizedPosting(
        company=company,
        title=title,
        url=url,
        raw_text=raw_text,
        source="lever",
        external_id=external_id,
    )


async def fetch_company(
    client: httpx.AsyncClient,
    company_slug: str,
) -> list[NormalizedPosting]:
    slug = company_slug.strip()
    if not slug:
        return []

    out: list[NormalizedPosting] = []
    skip = 0
    while True:
        data = await get_json(
            client,
            f"{BASE}/{slug}",
            params={"mode": "json", "limit": PAGE_SIZE, "skip": skip},
        )
        if not isinstance(data, list):
            break
        if not data:
            break
        for job in data:
            if not isinstance(job, dict):
                continue
            posting = _normalize_job(job, company_slug=slug)
            if posting is not None:
                out.append(posting)
        if len(data) < PAGE_SIZE:
            break
        skip += PAGE_SIZE
        # Safety cap — avoid runaway loops on misbehaving boards.
        if skip >= 1000:
            break
    return out


async def run(
    client: httpx.AsyncClient,
    *,
    companies: list[str],
    role_keywords: list[str],
    locations: list[str],
    experience_levels: list[str],
) -> tuple[ConnectorResult, list[NormalizedPosting]]:
    if not companies:
        return (
            ConnectorResult(
                source="lever",
                status="skipped",
                message="No Lever companies configured",
            ),
            [],
        )

    collected: list[NormalizedPosting] = []
    errors: list[str] = []
    rate_limited = False

    for company in companies:
        try:
            collected.extend(await fetch_company(client, company))
        except ConnectorHttpError as exc:
            errors.append(f"{company}: {exc.message}")
            rate_limited = rate_limited or exc.rate_limited
            logger.warning("lever_company_failed company=%s error=%s", company, exc.message)

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
            source="lever",
            status=status,
            fetched=len(collected),
            matched=len(matched),
            message=message,
        ),
        matched,
    )
