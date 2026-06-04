"""Aesthetic cooler buffer units from Supabase beer_aesthetic_buffer table."""
from __future__ import annotations

import datetime as dt
from typing import Any

from clover_client import allowed_beer_line_items, get_config
from supabase_client import get_supabase

_CACHE: dict[str, tuple[float, dict[str, dict[str, int]]]] = {}
_CACHE_TTL_SEC = 300

_HIGH_BUFFER_BEERS = frozenset({"michelob ultra", "miller lite", "modelo"})
_DEFAULT_BUFFER = 18
_HIGH_BUFFER = 36


def _fallback_buffer(beer_name: str) -> dict[str, int]:
    n = _HIGH_BUFFER if beer_name.strip().lower() in _HIGH_BUFFER_BEERS else _DEFAULT_BUFFER
    return {"wat": n, "lu": n}


def beer_aesthetic_buffers_from_supabase(*, force_refresh: bool = False) -> dict[str, Any]:
    cfg = get_config()
    cache_key = cfg.merchant_id
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    if not force_refresh and cache_key in _CACHE:
        ts, by_beer = _CACHE[cache_key]
        if now - ts < _CACHE_TTL_SEC:
            return {
                "ok": True,
                "merchant_id": cfg.merchant_id,
                "by_beer": by_beer,
                "from_cache": True,
            }

    db_rows: dict[str, dict[str, int]] = {}
    try:
        client = get_supabase()
        result = (
            client.table("beer_aesthetic_buffer")
            .select("beer_name,wat_buffer,lu_buffer")
            .eq("merchant_id", cfg.merchant_id)
            .execute()
        )
        for row in result.data or []:
            name = (row.get("beer_name") or "").strip()
            if name:
                db_rows[name.lower()] = {
                    "wat": int(row.get("wat_buffer") or 0),
                    "lu": int(row.get("lu_buffer") or 0),
                }
    except Exception:
        db_rows = {}

    by_beer: dict[str, dict[str, int]] = {}
    items_out: list[dict[str, Any]] = []
    for beer in allowed_beer_line_items():
        row = db_rows.get(beer.lower())
        if row and (row["wat"] > 0 or row["lu"] > 0):
            buf = row
            source = "database"
        else:
            buf = _fallback_buffer(beer)
            source = "fallback"
        by_beer[beer] = buf
        items_out.append(
            {
                "beer_name": beer,
                "wat_buffer": buf["wat"],
                "lu_buffer": buf["lu"],
                "source": source,
            }
        )

    _CACHE[cache_key] = (now, by_beer)
    return {
        "ok": True,
        "merchant_id": cfg.merchant_id,
        "items": items_out,
        "by_beer": by_beer,
        "from_cache": False,
    }


def aesthetic_buffer_for_beer(beer_name: str, *, force_refresh: bool = False) -> dict[str, int]:
    data = beer_aesthetic_buffers_from_supabase(force_refresh=force_refresh)
    by_beer: dict[str, dict[str, int]] = data.get("by_beer") or {}
    for name, buf in by_beer.items():
        if name.lower() == beer_name.strip().lower():
            return buf
    return _fallback_buffer(beer_name)
