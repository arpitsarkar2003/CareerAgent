"""Supabase client for elevated (secret / service_role) access."""

from __future__ import annotations

import os
from functools import lru_cache

from supabase import Client, create_client


def _elevated_key() -> str:
    key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get(
        "SUPABASE_SERVICE_ROLE_KEY"
    )
    if not key:
        raise RuntimeError(
            "Missing Supabase elevated key: set SUPABASE_SECRET_KEY "
            "(preferred) or SUPABASE_SERVICE_ROLE_KEY (legacy fallback)."
        )
    return key


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL")
    if not url:
        raise RuntimeError("Missing SUPABASE_URL.")
    return create_client(url, _elevated_key())
