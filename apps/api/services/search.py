"""Manual Run Search orchestration — no scheduling, no background jobs."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from services import job_postings as job_postings_service
from services import search_config as search_config_service
from services.connectors import ashby, greenhouse, lever
from services.connectors.http import DEFAULT_TIMEOUT_S
from services.connectors.types import ConnectorResult, NormalizedPosting

logger = logging.getLogger(__name__)


def _result_dict(result: ConnectorResult) -> dict[str, Any]:
    return {
        "source": result.source,
        "status": result.status,
        "fetched": result.fetched,
        "matched": result.matched,
        "inserted": result.inserted,
        "skipped_duplicates": result.skipped_duplicates,
        "message": result.message,
    }


async def _run_one(
    name: str,
    coro: Any,
) -> tuple[ConnectorResult, list[NormalizedPosting]]:
    """Isolate connector failures so one never blocks the others."""
    try:
        return await coro
    except Exception as exc:  # noqa: BLE001 — intentional isolation boundary
        logger.exception("connector_crashed source=%s", name)
        return (
            ConnectorResult(
                source=name,  # type: ignore[arg-type]
                status="failed",
                message=f"Unexpected error: {exc}",
            ),
            [],
        )


async def run_search(user_id: str) -> dict[str, Any]:
    """
    Explicit Run Search: fetch from all three connectors, store new rows,
    return per-connector status. Triggered only by an API call (dashboard click).
    """
    config = search_config_service.get_config(user_id)
    role_keywords = list(config["role_keywords"])
    locations = list(config["locations"])
    experience_levels = list(config["experience_levels"])

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_S) as client:
        gh_task = _run_one(
            "greenhouse",
            greenhouse.run(
                client,
                boards=list(config["greenhouse_boards"]),
                role_keywords=role_keywords,
                locations=locations,
                experience_levels=experience_levels,
            ),
        )
        lever_task = _run_one(
            "lever",
            lever.run(
                client,
                companies=list(config["lever_companies"]),
                role_keywords=role_keywords,
                locations=locations,
                experience_levels=experience_levels,
            ),
        )
        ashby_task = _run_one(
            "ashby",
            ashby.run(
                client,
                boards=list(config["ashby_boards"]),
                role_keywords=role_keywords,
                locations=locations,
                experience_levels=experience_levels,
            ),
        )
        results = await asyncio.gather(gh_task, lever_task, ashby_task)

    connector_summaries: list[dict[str, Any]] = []
    total_inserted = 0
    total_skipped = 0
    total_matched = 0
    scoring_queue: list[str] = []

    for result, matched in results:
        inserted_ids, skipped = job_postings_service.insert_postings_idempotent(
            user_id, matched
        )
        result.inserted = len(inserted_ids)
        result.skipped_duplicates = skipped
        total_inserted += len(inserted_ids)
        total_skipped += skipped
        total_matched += result.matched
        scoring_queue.extend(inserted_ids)
        connector_summaries.append(_result_dict(result))

    return {
        "connectors": connector_summaries,
        "total_matched": total_matched,
        "total_inserted": total_inserted,
        "total_skipped_duplicates": total_skipped,
        # Module 5: newly inserted posting IDs the client scores next, one
        # call per ID via the shared scoring endpoint. Never includes
        # duplicates skipped this run — those already have a score (or a
        # known failed state) from whenever they were first inserted.
        "scoring_queue": scoring_queue,
        "config": {
            "role_keywords": role_keywords,
            "locations": locations,
            "experience_levels": experience_levels,
            "greenhouse_boards": list(config["greenhouse_boards"]),
            "lever_companies": list(config["lever_companies"]),
            "ashby_boards": list(config["ashby_boards"]),
        },
    }
