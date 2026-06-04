"""Supabase client for usage history and par suggestions."""
from __future__ import annotations

import os
from typing import Any

from clover_client import ROOT, load_dotenv

_client: Any = None


def supabase_url() -> str:
    load_dotenv()
    url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
    if url:
        return url
    project_id = (os.getenv("SUPABASE_PROJECT_ID") or "").strip()
    if project_id:
        return f"https://{project_id}.supabase.co"
    return ""


def supabase_key() -> str:
    load_dotenv()
    return (
        (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
        or (os.getenv("SUPABASE_SECRET_KEY") or "").strip()
        or (os.getenv("SUPABASE_PUBLISHABLE_KEY") or "").strip()
        or (os.getenv("SUPABASE_ANON_KEY") or "").strip()
    )


def get_supabase():
    global _client
    if _client is not None:
        return _client

    url = supabase_url()
    key = supabase_key()
    if not url or not key:
        raise RuntimeError(
            "Supabase not configured. Set SUPABASE_URL (or SUPABASE_PROJECT_ID) and "
            "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_PUBLISHABLE_KEY in .env."
        )

    try:
        from supabase import create_client
    except ImportError as e:
        raise RuntimeError(
            "Install supabase: python3 -m pip install supabase"
        ) from e

    _client = create_client(url, key)
    return _client


def test_connection() -> dict[str, Any]:
    client = get_supabase()
    # lightweight read — table may not exist yet
    missing: list[str] = []
    for table in ("usage_weekly", "liquor_par", "beer_pack_size", "beer_aesthetic_buffer", "liquor_provi_product"):
        try:
            client.table(table).select("id", count="exact").limit(1).execute()
        except Exception as e:
            err = str(e)
            if "does not exist" in err or "PGRST205" in err:
                missing.append(table)
            else:
                raise RuntimeError(f"Supabase error: {err}") from e
    if missing:
        return {
            "ok": True,
            "message": f"Connected, but run migrations for: {', '.join(missing)}",
            "needs_migration": True,
            "missing_tables": missing,
        }
    return {"ok": True, "message": "Connected to Supabase (usage_weekly, liquor_par, beer_pack_size, beer_aesthetic_buffer, liquor_provi_product)."}
