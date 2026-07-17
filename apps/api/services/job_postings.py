"""Persist and list normalized job_postings (Module 4)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from db import get_supabase
from schemas.pagination import PaginatedData, PaginationParams
from services.connectors.types import NormalizedPosting


def _public_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "company": row["company"],
        "title": row["title"],
        "url": row.get("url"),
        "raw_text": row.get("raw_text"),
        "source": row.get("source"),
        "score": row.get("score"),
        "external_id": row.get("external_id"),
        "discovered_at": row.get("discovered_at"),
        "created_at": row.get("created_at"),
        "auto_apply_eligible": row.get("auto_apply_eligible", False),
    }


def _existing_keys(user_id: str, source: str) -> tuple[set[str], set[str]]:
    """Return (urls, external_ids) already stored for this user+source."""
    sb = get_supabase()
    result = (
        sb.table("job_postings")
        .select("url, external_id")
        .eq("user_id", user_id)
        .eq("source", source)
        .execute()
    )
    urls: set[str] = set()
    external_ids: set[str] = set()
    for row in result.data or []:
        url = row.get("url")
        if url:
            urls.add(str(url))
        eid = row.get("external_id")
        if eid:
            external_ids.add(str(eid))
    return urls, external_ids


def insert_postings_idempotent(
    user_id: str,
    postings: list[NormalizedPosting],
) -> tuple[int, int]:
    """
    Insert postings, skipping duplicates.

    Dedupe key (documented per Module 4 open question):
    1. Prefer (user_id, source, url) when url is present.
    2. Else (user_id, source, external_id) when external_id is present.
    3. Skip rows with neither url nor external_id (cannot dedupe safely).

    Returns (inserted_count, skipped_duplicates_count).
    """
    if not postings:
        return 0, 0

    # Group by source so we can batch-load existing keys once per source.
    by_source: dict[str, list[NormalizedPosting]] = {}
    for p in postings:
        by_source.setdefault(p.source, []).append(p)

    inserted = 0
    skipped = 0
    now = datetime.now(timezone.utc).isoformat()
    sb = get_supabase()

    for source, group in by_source.items():
        urls, eids = _existing_keys(user_id, source)
        batch: list[dict[str, Any]] = []

        for posting in group:
            url = (posting.url or "").strip() or None
            external_id = (posting.external_id or "").strip() or None

            if url and url in urls:
                skipped += 1
                continue
            if not url and external_id and external_id in eids:
                skipped += 1
                continue
            if not url and not external_id:
                skipped += 1
                continue

            # Also treat same external_id with a url as duplicate if already seen.
            if external_id and external_id in eids:
                skipped += 1
                continue

            row = {
                "user_id": user_id,
                "company": posting.company[:500],
                "title": posting.title[:500],
                "url": url,
                "raw_text": posting.raw_text,
                "source": posting.source,
                "external_id": external_id,
                "score": None,
                "score_reasoning": None,
                "auto_apply_eligible": False,
                "discovered_at": now,
            }
            batch.append(row)
            if url:
                urls.add(url)
            if external_id:
                eids.add(external_id)

        if not batch:
            continue

        # Insert in chunks; unique indexes are a second line of defense.
        chunk_size = 50
        for i in range(0, len(batch), chunk_size):
            chunk = batch[i : i + chunk_size]
            try:
                result = sb.table("job_postings").insert(chunk).execute()
                inserted += len(result.data or chunk)
            except Exception:
                # Fall back to per-row insert so one conflict doesn't drop a batch.
                for row in chunk:
                    try:
                        sb.table("job_postings").insert(row).execute()
                        inserted += 1
                    except Exception:
                        skipped += 1

    return inserted, skipped


def list_postings(
    user_id: str,
    pagination: PaginationParams,
    *,
    source: str | None = None,
) -> PaginatedData[dict[str, Any]]:
    sb = get_supabase()
    query = (
        sb.table("job_postings")
        .select("*", count="exact")
        .eq("user_id", user_id)
        .order("discovered_at", desc=True, nullsfirst=False)
        .order("created_at", desc=True)
    )
    if source:
        query = query.eq("source", source)

    result = (
        query.range(pagination.offset, pagination.offset + pagination.limit - 1)
        .execute()
    )
    rows = result.data or []
    total = result.count if result.count is not None else len(rows)
    return PaginatedData(
        items=[_public_row(r) for r in rows],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )
