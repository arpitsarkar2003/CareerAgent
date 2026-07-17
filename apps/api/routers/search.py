"""Job search connectors — Module 4 product routes."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from auth import require_user_id
from schemas.envelope import ok_response
from schemas.pagination import pagination_query
from services import job_postings as job_postings_service
from services import search as search_service
from services import search_config as search_config_service

router = APIRouter(tags=["search"])

SourceFilter = Literal["greenhouse", "lever", "ashby", "manual"]


class SearchConfigBody(BaseModel):
    role_keywords: list[str] | None = None
    locations: list[str] | None = None
    experience_levels: list[str] | None = None
    greenhouse_boards: list[str] | None = None
    lever_companies: list[str] | None = None
    ashby_boards: list[str] | None = None


@router.get("/config")
async def get_search_config(
    user_id: str = Depends(require_user_id),
) -> dict[str, Any]:
    data = search_config_service.get_config(user_id)
    return ok_response(data)


@router.put("/config")
async def put_search_config(
    body: SearchConfigBody,
    user_id: str = Depends(require_user_id),
) -> dict[str, Any]:
    data = search_config_service.upsert_config(
        user_id,
        role_keywords=body.role_keywords,
        locations=body.locations,
        experience_levels=body.experience_levels,
        greenhouse_boards=body.greenhouse_boards,
        lever_companies=body.lever_companies,
        ashby_boards=body.ashby_boards,
    )
    return ok_response(data)


@router.post("/runs")
async def create_search_run(
    user_id: str = Depends(require_user_id),
) -> dict[str, Any]:
    """Explicit Run Search — no scheduling. Fires all configured connectors."""
    data = await search_service.run_search(user_id)
    return ok_response(data)


@router.get("/postings")
async def get_postings(
    user_id: str = Depends(require_user_id),
    pagination=Depends(pagination_query),
    source: SourceFilter | None = Query(default=None),
) -> dict[str, Any]:
    data = job_postings_service.list_postings(
        user_id=user_id,
        pagination=pagination,
        source=source,
    )
    return ok_response(data.model_dump())
