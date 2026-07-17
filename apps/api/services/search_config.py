"""Editable search configuration (role/location/experience + board tokens)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from db import get_supabase
from errors import ValidationAppError

MAX_LIST_ITEMS = 50
MAX_ITEM_LEN = 100


def _clean_list(values: list[str] | None, *, field: str) -> list[str]:
    if values is None:
        return []
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in values:
        item = (raw or "").strip()
        if not item:
            continue
        if len(item) > MAX_ITEM_LEN:
            raise ValidationAppError(
                f"{field} entries must be at most {MAX_ITEM_LEN} characters"
            )
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(item)
    if len(cleaned) > MAX_LIST_ITEMS:
        raise ValidationAppError(
            f"{field} accepts at most {MAX_LIST_ITEMS} entries"
        )
    return cleaned


def _row_to_config(row: dict[str, Any] | None, *, user_id: str) -> dict[str, Any]:
    if not row:
        return {
            "user_id": user_id,
            "role_keywords": [],
            "locations": [],
            "experience_levels": [],
            "greenhouse_boards": [],
            "lever_companies": [],
            "ashby_boards": [],
            "updated_at": None,
            "created_at": None,
        }
    return {
        "user_id": row["user_id"],
        "role_keywords": list(row.get("role_keywords") or []),
        "locations": list(row.get("locations") or []),
        "experience_levels": list(row.get("experience_levels") or []),
        "greenhouse_boards": list(row.get("greenhouse_boards") or []),
        "lever_companies": list(row.get("lever_companies") or []),
        "ashby_boards": list(row.get("ashby_boards") or []),
        "updated_at": row.get("updated_at"),
        "created_at": row.get("created_at"),
    }


def get_config(user_id: str) -> dict[str, Any]:
    sb = get_supabase()
    result = (
        sb.table("search_configs")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return _row_to_config(rows[0] if rows else None, user_id=user_id)


def upsert_config(
    user_id: str,
    *,
    role_keywords: list[str] | None = None,
    locations: list[str] | None = None,
    experience_levels: list[str] | None = None,
    greenhouse_boards: list[str] | None = None,
    lever_companies: list[str] | None = None,
    ashby_boards: list[str] | None = None,
) -> dict[str, Any]:
    existing = get_config(user_id)
    now = datetime.now(timezone.utc).isoformat()

    payload = {
        "user_id": user_id,
        "role_keywords": (
            _clean_list(role_keywords, field="role_keywords")
            if role_keywords is not None
            else existing["role_keywords"]
        ),
        "locations": (
            _clean_list(locations, field="locations")
            if locations is not None
            else existing["locations"]
        ),
        "experience_levels": (
            _clean_list(experience_levels, field="experience_levels")
            if experience_levels is not None
            else existing["experience_levels"]
        ),
        "greenhouse_boards": (
            _clean_list(greenhouse_boards, field="greenhouse_boards")
            if greenhouse_boards is not None
            else existing["greenhouse_boards"]
        ),
        "lever_companies": (
            _clean_list(lever_companies, field="lever_companies")
            if lever_companies is not None
            else existing["lever_companies"]
        ),
        "ashby_boards": (
            _clean_list(ashby_boards, field="ashby_boards")
            if ashby_boards is not None
            else existing["ashby_boards"]
        ),
        "updated_at": now,
    }
    if not existing.get("created_at"):
        payload["created_at"] = now

    sb = get_supabase()
    result = (
        sb.table("search_configs")
        .upsert(payload, on_conflict="user_id")
        .execute()
    )
    rows = result.data or []
    if rows:
        return _row_to_config(rows[0], user_id=user_id)
    return get_config(user_id)
