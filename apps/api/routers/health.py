"""Health and connectivity probes."""

from fastapi import APIRouter, HTTPException

from db import get_supabase

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/db")
async def health_db() -> dict[str, str]:
    """Lightweight Supabase connectivity check. Never returns secrets."""
    try:
        client = get_supabase()
        # Trivial select — succeeds when URL + elevated key can reach PostgREST
        # and the knowledge_chunks table exists (Module 1 migration applied).
        client.table("knowledge_chunks").select("id").limit(1).execute()
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database unreachable or misconfigured",
        ) from None
    return {"status": "ok", "db": "ok"}
