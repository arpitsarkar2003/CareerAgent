"""Knowledge base ingest / CRUD service."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from ai.embed import embed_text
from db import get_supabase
from errors import NotFoundError, ValidationAppError
from schemas.pagination import PaginatedData, PaginationParams
from services.chunking import SourceType, chunk_text
from services.parse import parse_file_bytes

SOURCE_TYPES = frozenset({"resume", "cover_letter", "project", "note"})


def _validate_source_type(value: str) -> SourceType:
    if value not in SOURCE_TYPES:
        raise ValidationAppError(
            "source_type must be one of: resume, cover_letter, project, note"
        )
    return value  # type: ignore[return-value]


async def ingest_source(
    *,
    user_id: str,
    source_type: str,
    source_name: str,
    text: str | None = None,
    filename: str | None = None,
    file_bytes: bytes | None = None,
) -> dict[str, Any]:
    st = _validate_source_type(source_type)
    name = (source_name or "").strip()
    if not name:
        raise ValidationAppError("source_name is required")

    if file_bytes is not None:
        content = parse_file_bytes(filename or "upload.txt", file_bytes)
    elif text is not None:
        content = text.strip()
        if not content:
            raise ValidationAppError("text is empty")
    else:
        raise ValidationAppError("Provide either text or a file")

    drafts = chunk_text(st, content)
    if not drafts:
        raise ValidationAppError("No chunks produced from content")

    chunk_payload: list[dict[str, Any]] = []
    for draft in drafts:
        vector = await embed_text(draft.content)
        chunk_payload.append(
            {
                "content": draft.content,
                "embedding": vector,
                "metadata": draft.metadata or {},
            }
        )

    sb = get_supabase()
    result = sb.rpc(
        "replace_knowledge_source",
        {
            "p_user_id": user_id,
            "p_source_type": st,
            "p_source_name": name,
            "p_chunks": chunk_payload,
        },
    ).execute()

    rows = result.data or []
    return {
        "source_type": st,
        "source_name": name,
        "chunk_count": len(rows),
        "chunks": [_public_chunk(r) for r in rows],
    }


def list_sources(
    *,
    user_id: str,
    pagination: PaginationParams,
) -> PaginatedData[dict[str, Any]]:
    sb = get_supabase()
    # Fetch all chunk rows for aggregation (personal KB stays small).
    res = (
        sb.table("knowledge_chunks")
        .select("source_type,source_name,created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    rows = res.data or []
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    for row in rows:
        key = (row["source_type"], row["source_name"])
        if key not in grouped:
            grouped[key] = {
                "source_type": row["source_type"],
                "source_name": row["source_name"],
                "chunk_count": 0,
                "created_at": row["created_at"],
            }
        grouped[key]["chunk_count"] += 1
        # Keep earliest created_at as source created
        if row["created_at"] < grouped[key]["created_at"]:
            grouped[key]["created_at"] = row["created_at"]

    items = sorted(
        grouped.values(),
        key=lambda s: s["created_at"],
        reverse=True,
    )
    total = len(items)
    page = items[pagination.offset : pagination.offset + pagination.limit]
    return PaginatedData(
        items=page,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


def list_chunks(
    *,
    user_id: str,
    source_type: str,
    source_name: str,
    pagination: PaginationParams,
) -> PaginatedData[dict[str, Any]]:
    st = _validate_source_type(source_type)
    name = source_name.strip()
    if not name:
        raise ValidationAppError("source_name is required")

    sb = get_supabase()
    count_res = (
        sb.table("knowledge_chunks")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("source_type", st)
        .eq("source_name", name)
        .execute()
    )
    total = count_res.count if count_res.count is not None else len(count_res.data or [])

    res = (
        sb.table("knowledge_chunks")
        .select("id,user_id,source_type,source_name,content,metadata,created_at")
        .eq("user_id", user_id)
        .eq("source_type", st)
        .eq("source_name", name)
        .order("created_at", desc=False)
        .range(pagination.offset, pagination.offset + pagination.limit - 1)
        .execute()
    )
    items = [_public_chunk(r) for r in (res.data or [])]
    return PaginatedData(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


async def update_chunk(
    *,
    user_id: str,
    chunk_id: str,
    content: str,
) -> dict[str, Any]:
    text = (content or "").strip()
    if not text:
        raise ValidationAppError("content cannot be empty")

    _parse_uuid(chunk_id)
    sb = get_supabase()
    existing = (
        sb.table("knowledge_chunks")
        .select("id,user_id,source_type,source_name,metadata,created_at")
        .eq("id", chunk_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise NotFoundError("Chunk not found")

    vector = await embed_text(text)
    updated = (
        sb.table("knowledge_chunks")
        .update({"content": text, "embedding": vector})
        .eq("id", chunk_id)
        .eq("user_id", user_id)
        .select("id,user_id,source_type,source_name,content,metadata,created_at")
        .execute()
    )
    if not updated.data:
        raise NotFoundError("Chunk not found")
    return _public_chunk(updated.data[0])


def delete_chunk(*, user_id: str, chunk_id: str) -> dict[str, Any]:
    _parse_uuid(chunk_id)
    sb = get_supabase()
    existing = (
        sb.table("knowledge_chunks")
        .select("id")
        .eq("id", chunk_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise NotFoundError("Chunk not found")

    sb.table("knowledge_chunks").delete().eq("id", chunk_id).eq(
        "user_id", user_id
    ).execute()
    return {"id": chunk_id, "deleted": True}


def delete_source(
    *,
    user_id: str,
    source_type: str,
    source_name: str,
) -> dict[str, Any]:
    st = _validate_source_type(source_type)
    name = source_name.strip()
    if not name:
        raise ValidationAppError("source_name is required")

    sb = get_supabase()
    existing = (
        sb.table("knowledge_chunks")
        .select("id")
        .eq("user_id", user_id)
        .eq("source_type", st)
        .eq("source_name", name)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise NotFoundError("Source not found")

    sb.table("knowledge_chunks").delete().eq("user_id", user_id).eq(
        "source_type", st
    ).eq("source_name", name).execute()
    return {
        "source_type": st,
        "source_name": name,
        "deleted": True,
    }


def _public_chunk(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "source_type": row["source_type"],
        "source_name": row["source_name"],
        "content": row["content"],
        "metadata": row.get("metadata") or {},
        "created_at": row["created_at"],
    }


def _parse_uuid(value: str) -> UUID:
    try:
        return UUID(value)
    except (ValueError, TypeError):
        raise ValidationAppError("Invalid chunk id") from None
