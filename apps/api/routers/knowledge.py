"""Knowledge sources and chunks — Module 2 product routes."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from auth import require_user_id
from errors import ValidationAppError
from schemas.envelope import ok_response
from schemas.pagination import pagination_query
from services import knowledge as knowledge_service

router = APIRouter(tags=["knowledge"])

SourceTypeLiteral = Literal["resume", "cover_letter", "project", "note"]


class IngestJsonBody(BaseModel):
    source_type: SourceTypeLiteral
    source_name: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1)


class UpdateChunkBody(BaseModel):
    content: str = Field(min_length=1)


@router.post("/sources")
async def create_source(
    request: Request,
    user_id: str = Depends(require_user_id),
) -> dict[str, Any]:
    """
    Ingest a source.

    - `application/json`: `{ source_type, source_name, text }`
    - `multipart/form-data`: fields `source_type`, `source_name`, optional `text` / `file`
    """
    content_type = (request.headers.get("content-type") or "").lower()

    if "application/json" in content_type:
        raw = await request.json()
        body = IngestJsonBody.model_validate(raw)
        data = await knowledge_service.ingest_source(
            user_id=user_id,
            source_type=body.source_type,
            source_name=body.source_name,
            text=body.text,
        )
        return ok_response(data)

    if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        source_type = str(form.get("source_type") or "")
        source_name = str(form.get("source_name") or "")
        text_val = form.get("text")
        text = str(text_val) if text_val is not None and str(text_val).strip() else None
        upload = form.get("file")

        file_bytes: bytes | None = None
        filename: str | None = None
        if upload is not None and hasattr(upload, "read"):
            file_bytes = await upload.read()  # type: ignore[misc]
            filename = getattr(upload, "filename", None) or "upload.bin"

        if not source_type or not source_name:
            raise ValidationAppError("source_type and source_name are required")

        data = await knowledge_service.ingest_source(
            user_id=user_id,
            source_type=source_type,
            source_name=source_name,
            text=text,
            filename=filename,
            file_bytes=file_bytes,
        )
        return ok_response(data)

    raise ValidationAppError(
        "Content-Type must be application/json or multipart/form-data"
    )


@router.get("/sources")
async def get_sources(
    user_id: str = Depends(require_user_id),
    pagination=Depends(pagination_query),
) -> dict[str, Any]:
    data = knowledge_service.list_sources(user_id=user_id, pagination=pagination)
    return ok_response(data.model_dump())


@router.delete("/sources")
async def remove_source(
    source_type: SourceTypeLiteral = Query(...),
    source_name: str = Query(..., min_length=1),
    user_id: str = Depends(require_user_id),
) -> dict[str, Any]:
    data = knowledge_service.delete_source(
        user_id=user_id,
        source_type=source_type,
        source_name=source_name,
    )
    return ok_response(data)


@router.get("/chunks")
async def get_chunks(
    source_type: SourceTypeLiteral = Query(...),
    source_name: str = Query(..., min_length=1),
    user_id: str = Depends(require_user_id),
    pagination=Depends(pagination_query),
) -> dict[str, Any]:
    data = knowledge_service.list_chunks(
        user_id=user_id,
        source_type=source_type,
        source_name=source_name,
        pagination=pagination,
    )
    return ok_response(data.model_dump())


@router.patch("/chunks/{chunk_id}")
async def patch_chunk(
    chunk_id: str,
    body: UpdateChunkBody,
    user_id: str = Depends(require_user_id),
) -> dict[str, Any]:
    data = await knowledge_service.update_chunk(
        user_id=user_id,
        chunk_id=chunk_id,
        content=body.content,
    )
    return ok_response(data)


@router.delete("/chunks/{chunk_id}")
async def remove_chunk(
    chunk_id: str,
    user_id: str = Depends(require_user_id),
) -> dict[str, Any]:
    data = knowledge_service.delete_chunk(user_id=user_id, chunk_id=chunk_id)
    return ok_response(data)
