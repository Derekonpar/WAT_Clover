"""Sync Clover weekly usage into Supabase and compute par from averages."""
from __future__ import annotations

import datetime as dt
import math
from typing import Any

from clover_client import fetch_usage_report, get_config
from supabase_client import get_supabase
from week_calendar import last_complete_sun_sat_week, last_n_week_ranges


def round_par_to_pack(units: float, pack_size: int) -> int:
    """Round usage-based par up to a multiple of pack_size. Returns 0 when usage is 0."""
    pack = max(1, int(pack_size))
    if units <= 0:
        return 0
    return int(math.ceil(units / pack) * pack)


def sync_week_range_to_supabase(
    week_start: dt.date,
    week_end: dt.date,
    *,
    force_refresh: bool = False,
) -> dict[str, Any]:
    """Pull one Sun–Sat week from Clover and upsert into usage_weekly."""
    cfg = get_config()
    client = get_supabase()
    report = fetch_usage_report(
        str(week_start),
        str(week_end),
        force_refresh=force_refresh,
    )
    batch = []
    for item in report.get("items") or []:
        qty = int(item.get("quantity_sold") or 0)
        batch.append(
            {
                "merchant_id": cfg.merchant_id,
                "week_start": str(week_start),
                "week_end": str(week_end),
                "item_name": item["name"],
                "category_name": item.get("category_name") or "",
                "quantity_sold": qty,
                "gross_minor_units": int(item.get("gross_minor_units") or 0),
                "synced_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            }
        )

    if batch:
        client.table("usage_weekly").upsert(
            batch,
            on_conflict="merchant_id,week_start,item_name",
        ).execute()

    return {
        "week_start": str(week_start),
        "week_end": str(week_end),
        "items": len(batch),
        "units": sum(r["quantity_sold"] for r in batch),
    }


def sync_weeks_to_supabase(
    weeks: int = 8,
    *,
    force_refresh: bool = False,
) -> dict[str, Any]:
    """Pull usage from Clover for each week and upsert into usage_weekly."""
    cfg = get_config()
    ranges = last_n_week_ranges(weeks)
    synced_weeks: list[dict[str, Any]] = []
    rows_upserted = 0

    for week_start, week_end in ranges:
        one = sync_week_range_to_supabase(week_start, week_end, force_refresh=force_refresh)
        synced_weeks.append(one)
        rows_upserted += one.get("items", 0)

    return {
        "ok": True,
        "merchant_id": cfg.merchant_id,
        "weeks_requested": weeks,
        "weeks_synced": synced_weeks,
        "rows_upserted": rows_upserted,
    }


def _weeks_stored_in_supabase(client: Any, merchant_id: str) -> int:
    result = (
        client.table("usage_weekly")
        .select("week_start")
        .eq("merchant_id", merchant_id)
        .execute()
    )
    return len({row.get("week_start") for row in (result.data or []) if row.get("week_start")})


def clear_beer_par_cache() -> None:
    _BEER_PAR_CACHE.clear()


_BEER_PAR_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_BEER_PAR_CACHE_TTL_SEC = 300


def suggested_par_from_supabase(
    weeks: int = 6,
    *,
    fallback_config: bool = True,
    force_refresh: bool = False,
) -> dict[str, Any]:
    """
    Beer only: par = half of 6-week avg usage per cooler (rounded to pack) + aesthetic buffer.
    Clover reports combined sales; usage is split 50/50 between WAT and LU.
    """
    from beer_buffer import aesthetic_buffer_for_beer
    from beer_pack import pack_size_for_beer
    from clover_client import (
        allowed_beer_line_items,
        canonical_beer_name,
    )

    cfg = get_config()
    cache_key = f"{cfg.merchant_id}:{weeks}"
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    if not force_refresh and cache_key in _BEER_PAR_CACHE:
        ts, data = _BEER_PAR_CACHE[cache_key]
        if now - ts < _BEER_PAR_CACHE_TTL_SEC:
            return {**data, "from_cache": True}

    beer_names = {n.lower(): n for n in allowed_beer_line_items()}
    client = get_supabase()
    ranges = last_n_week_ranges(weeks)
    if not ranges:
        raise ValueError("No week ranges to average")

    week_starts = [str(r[0]) for r in ranges]
    result = (
        client.table("usage_weekly")
        .select("item_name,category_name,week_start,quantity_sold")
        .eq("merchant_id", cfg.merchant_id)
        .in_("week_start", week_starts)
        .execute()
    )
    rows = result.data or []

    by_item: dict[str, dict[str, Any]] = {}
    for row in rows:
        raw_name = (row.get("item_name") or "").strip()
        canonical = canonical_beer_name(raw_name) or raw_name
        key = canonical.lower()
        if key not in beer_names:
            continue
        if key not in by_item:
            by_item[key] = {
                "name": beer_names[key],
                "category_name": "Beer",
                "weekly_qty": {},
            }
        ws = row.get("week_start")
        by_item[key]["weekly_qty"][ws] = int(row.get("quantity_sold") or 0)

    pack_cache: dict[str, int] = {}
    buffer_cache: dict[str, dict[str, int]] = {}

    def _pack(beer: str) -> int:
        if beer not in pack_cache:
            pack_cache[beer] = pack_size_for_beer(beer)
        return pack_cache[beer]

    def _buffer(beer: str) -> dict[str, int]:
        if beer not in buffer_cache:
            buffer_cache[beer] = aesthetic_buffer_for_beer(beer)
        return buffer_cache[beer]

    items_out: list[dict[str, Any]] = []
    for entry in by_item.values():
        beer = entry["name"]
        weekly = list(entry["weekly_qty"].values())
        weeks_with_data = len(weekly)
        avg_weekly = sum(weekly) / weeks if weeks else 0.0
        pack = _pack(beer)
        buf = _buffer(beer)
        base = round_par_to_pack(avg_weekly / 2, pack)
        wat_par = base + buf["wat"]
        lu_par = base + buf["lu"]
        items_out.append(
            {
                "name": beer,
                "category_name": entry["category_name"],
                "avg_weekly": round(avg_weekly, 2),
                "weeks_with_data": weeks_with_data,
                "weeks_requested": weeks,
                "pack_size": pack,
                "usage_par": base,
                "wat_buffer": buf["wat"],
                "lu_buffer": buf["lu"],
                "suggested_par": max(wat_par, lu_par),
                "wat_par": wat_par,
                "lu_par": lu_par,
            }
        )

    items_out.sort(key=lambda r: r["name"].lower())

    if fallback_config:
        existing = {i["name"].lower() for i in items_out}
        for canonical in allowed_beer_line_items():
            key = canonical.lower()
            if key in existing:
                continue
            pack = _pack(canonical)
            buf = _buffer(canonical)
            base = round_par_to_pack(0, pack)
            wat_par = base + buf["wat"]
            lu_par = base + buf["lu"]
            items_out.append(
                {
                    "name": canonical,
                    "category_name": "Beer",
                    "avg_weekly": 0,
                    "weeks_with_data": 0,
                    "weeks_requested": weeks,
                    "pack_size": pack,
                    "usage_par": base,
                    "wat_buffer": buf["wat"],
                    "lu_buffer": buf["lu"],
                    "suggested_par": max(wat_par, lu_par),
                    "wat_par": wat_par,
                    "lu_par": lu_par,
                }
            )
        items_out.sort(key=lambda r: r["name"].lower())

    payload = {
        "ok": True,
        "merchant_id": cfg.merchant_id,
        "weeks": weeks,
        "week_ranges": [{"start": ws, "end": we} for ws, we in ranges],
        "items": items_out,
        "scope": "beer",
        "note": (
            "Beer only: 6-week Sun–Sat average split 50/50 per cooler, rounded to pack size, "
            "plus aesthetic buffer per location (beer_aesthetic_buffer)."
        ),
        "from_cache": False,
    }
    _BEER_PAR_CACHE[cache_key] = (now, payload)
    return payload


def update_beer_par_for_orders(
    *,
    force_refresh: bool = True,
    par_weeks: int = 6,
    bootstrap_weeks: int = 8,
) -> dict[str, Any]:
    """
    One-step flow for Sunday orders:
    1) Sync last complete Sun–Sat week to Supabase (bootstrap 8 weeks if DB is sparse)
    2) Return fresh 6-week average par for beer inventory
    """
    cfg = get_config()
    client = get_supabase()
    week_start, week_end = last_complete_sun_sat_week()
    stored_weeks = _weeks_stored_in_supabase(client, cfg.merchant_id)

    if stored_weeks < par_weeks:
        sync_result = sync_weeks_to_supabase(bootstrap_weeks, force_refresh=force_refresh)
        mode = "bootstrap"
    else:
        one = sync_week_range_to_supabase(week_start, week_end, force_refresh=force_refresh)
        sync_result = {
            "ok": True,
            "merchant_id": cfg.merchant_id,
            "weeks_requested": 1,
            "weeks_synced": [one],
            "rows_upserted": one.get("items", 0),
        }
        mode = "last_week"

    clear_beer_par_cache()
    par = suggested_par_from_supabase(par_weeks, force_refresh=True)

    return {
        "ok": True,
        "mode": mode,
        "order_week": {
            "start": str(week_start),
            "end": str(week_end),
            "label": (
                f"Sun {week_start.strftime('%b')} {week_start.day} – "
                f"Sat {week_end.strftime('%b')} {week_end.day}"
            ),
        },
        "sync": sync_result,
        "par": par,
    }
