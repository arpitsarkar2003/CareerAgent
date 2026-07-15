"""DB package — Supabase elevated client (local name avoids shadowing supabase-py)."""

from db.client import get_supabase

__all__ = ["get_supabase"]
