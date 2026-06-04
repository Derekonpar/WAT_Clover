"""Provi / OHLQ product mapping for liquor orders (Supabase liquor_provi_product)."""
from __future__ import annotations

import datetime as dt
from typing import Any

from clover_client import get_config
from supabase_client import get_supabase

_CACHE: dict[str, tuple[float, dict[str, dict[str, Any]]]] = {}
_CACHE_TTL_SEC = 300

# Fallback when migration not applied — keep in sync with 006_liquor_provi_product.sql
_FALLBACK: dict[str, dict[str, Any]] = {
    "Amaretto": {"provi_product_id": "0071B", "order_via": "catalog"},
    "Svedka Blue Raspberry": {"provi_product_id": "8867B", "order_via": "catalog"},
    "Knobb Creek Maple": {"provi_product_id": "5480B", "order_via": "catalog"},
    "Crown Royal Apple Shot": {"provi_product_id": "2383L", "order_via": "catalog"},
    "Captain Morgan Shot": {"provi_product_id": "1755L", "order_via": "catalog"},
    "Woodford Reserve Shot": {"provi_product_id": "9674L", "order_via": "catalog"},
    "Tito Shot": {"provi_product_id": "9232L", "order_via": "catalog"},
    "Patron Shot": {"provi_product_id": "7984B", "order_via": "catalog"},
    "Jack Daniel Shot": {"provi_product_id": "0066L", "order_via": "catalog"},
    "Cruzan Vanilla": {"provi_product_id": None, "order_via": "rep_notes"},
    "Triple Sec": {"provi_product_id": None, "order_via": "rep_notes"},
    "Strawberry Pucker": {"provi_product_id": None, "order_via": "rep_notes"},
    "Orange bitters": {"provi_product_id": None, "order_via": "rep_notes"},
    "Midori": {"provi_product_id": None, "order_via": "rep_notes"},
    "Simple Syrup": {"provi_product_id": None, "order_via": "rep_notes"},
    "Grenadine": {"provi_product_id": None, "order_via": "rep_notes"},
    "Sour mix": {"provi_product_id": None, "order_via": "rep_notes"},
}


def liquor_provi_map_from_supabase(*, force_refresh: bool = False) -> dict[str, Any]:
    cfg = get_config()
    cache_key = cfg.merchant_id
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    if not force_refresh and cache_key in _CACHE:
        ts, by_name = _CACHE[cache_key]
        if now - ts < _CACHE_TTL_SEC:
            return {
                "ok": True,
                "merchant_id": cfg.merchant_id,
                "by_name": by_name,
                "from_cache": True,
            }

    db_rows: dict[str, dict[str, Any]] = {}
    try:
        client = get_supabase()
        result = (
            client.table("liquor_provi_product")
            .select("item_name,provi_product_id,order_via")
            .eq("merchant_id", cfg.merchant_id)
            .execute()
        )
        for row in result.data or []:
            name = (row.get("item_name") or "").strip()
            if name:
                db_rows[name.lower()] = {
                    "item_name": name,
                    "provi_product_id": (row.get("provi_product_id") or "").strip() or None,
                    "order_via": (row.get("order_via") or "catalog").strip(),
                }
    except Exception:
        db_rows = {}

    by_name: dict[str, dict[str, Any]] = {}
    items_out: list[dict[str, Any]] = []
    for item_name, fallback in _FALLBACK.items():
        row = db_rows.get(item_name.lower())
        if row:
            entry = row
            source = "database"
        else:
            entry = {
                "item_name": item_name,
                "provi_product_id": fallback.get("provi_product_id"),
                "order_via": fallback.get("order_via", "catalog"),
            }
            source = "fallback"
        by_name[item_name.lower()] = entry
        items_out.append({**entry, "source": source})

    _CACHE[cache_key] = (now, by_name)
    return {
        "ok": True,
        "merchant_id": cfg.merchant_id,
        "items": items_out,
        "by_name": by_name,
        "from_cache": False,
    }


def lookup_provi_product(item_name: str, *, force_refresh: bool = False) -> dict[str, Any] | None:
    data = liquor_provi_map_from_supabase(force_refresh=force_refresh)
    by_name: dict[str, dict[str, Any]] = data.get("by_name") or {}
    return by_name.get(item_name.strip().lower())
