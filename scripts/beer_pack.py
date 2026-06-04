"""Beer case/pack sizes from Supabase beer_pack_size table."""
from __future__ import annotations

import datetime as dt
from typing import Any

from clover_client import allowed_beer_line_items, get_config
from supabase_client import get_supabase

_CACHE: dict[str, tuple[float, dict[str, int]]] = {}
_CACHE_TTL_SEC = 300

# Fallback when DB row missing (matches original distributor rules)
_FALLBACK: dict[str, tuple[str, int]] = {
    "Miller Lite": ("bonbright", 12),
    "Guinness": ("bonbright", 12),
    "Blue Moon": ("bonbright", 12),
    "Coors Light": ("bonbright", 8),
    "Modelo": ("bonbright", 12),
    "Michelob Ultra": ("heidelberg", 24),
    "Yuengling": ("heidelberg", 24),
    "Bud Light": ("heidelberg", 24),
    "Angry Orchard": ("heidelberg", 24),
    "High Noon Pineapple": ("heidelberg", 24),
    "Busch Light": ("heidelberg", 24),
    "Truth": ("heidelberg", 24),
    "Boat Show (Yellow Springs)": ("yellow_springs", 12),
}


def _fallback_pack_size(beer_name: str) -> int:
    key = beer_name.strip()
    for name, (_, size) in _FALLBACK.items():
        if name.lower() == key.lower():
            return size
    return 12


def beer_pack_sizes_from_supabase(*, force_refresh: bool = False) -> dict[str, Any]:
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

    by_beer: dict[str, int] = {}
    db_rows: dict[str, dict[str, Any]] = {}
    try:
        client = get_supabase()
        result = (
            client.table("beer_pack_size")
            .select("beer_name,distributor_id,pack_size")
            .eq("merchant_id", cfg.merchant_id)
            .execute()
        )
        for row in result.data or []:
            name = (row.get("beer_name") or "").strip()
            if name:
                db_rows[name.lower()] = row
    except Exception:
        db_rows = {}

    items_out: list[dict[str, Any]] = []
    for beer in allowed_beer_line_items():
        row = db_rows.get(beer.lower())
        if row:
            pack = int(row.get("pack_size") or 12)
            dist = row.get("distributor_id") or ""
            source = "database"
        else:
            dist, pack = _FALLBACK.get(beer, ("", 12))
            source = "fallback"
        by_beer[beer] = pack
        items_out.append(
            {
                "beer_name": beer,
                "distributor_id": dist,
                "pack_size": pack,
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


def pack_size_for_beer(beer_name: str, *, force_refresh: bool = False) -> int:
    data = beer_pack_sizes_from_supabase(force_refresh=force_refresh)
    by_beer: dict[str, int] = data.get("by_beer") or {}
    for name, size in by_beer.items():
        if name.lower() == beer_name.strip().lower():
            return size
    return _fallback_pack_size(beer_name)
