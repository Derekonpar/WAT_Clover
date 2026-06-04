"""Fixed liquor/shot par levels from Supabase (not usage-based)."""
from __future__ import annotations

import datetime as dt
from typing import Any

from clover_client import liquor_inventory_item_registry, canonical_beer_name, get_config, liquor_par_from_config
from liquor_par_yaml import load_liquor_par_build_file
from supabase_client import get_supabase

_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_TTL_SEC = 300  # 5 min — avoid repeated Supabase reads


def liquor_par_from_supabase(*, force_refresh: bool = False) -> dict[str, Any]:
    """Par for liquor catalog items from liquor_par table (fallback config.yaml)."""
    cfg = get_config()
    cache_key = cfg.merchant_id
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    if not force_refresh and cache_key in _CACHE:
        ts, data = _CACHE[cache_key]
        if now - ts < _CACHE_TTL_SEC:
            return {**data, "from_cache": True}

    client = get_supabase()
    registry = liquor_inventory_item_registry(cfg, force_refresh=False)
    yaml_pars = liquor_par_from_config()
    build_pars: dict[str, dict[str, int]] = load_liquor_par_build_file().get("items") or {}

    db_rows: dict[str, dict[str, int]] = {}
    try:
        result = (
            client.table("liquor_par")
            .select("item_name,wat_par,lu_par")
            .eq("merchant_id", cfg.merchant_id)
            .execute()
        )
        for row in result.data or []:
            name = (row.get("item_name") or "").strip()
            if name:
                db_rows[name.lower()] = {
                    "wat": int(row.get("wat_par") or 0),
                    "lu": int(row.get("lu_par") or 0),
                }
    except Exception:
        db_rows = {}

    items_out: list[dict[str, Any]] = []
    for reg in registry["items"]:
        if canonical_beer_name(reg["name"]):
            continue
        key = reg["name"].lower()
        pars = db_rows.get(key) or {}
        source = "database" if key in db_rows else "unset"
        if not pars:
            for yname, yp in yaml_pars.items():
                if yname.lower() == key:
                    pars = yp
                    source = "config"
                    break
        if not pars:
            for yname, yp in build_pars.items():
                if yname.lower() == key:
                    pars = yp
                    source = "build_file"
                    break
        wat = int(pars.get("wat") or 0)
        lu = int(pars.get("lu") or 0)
        items_out.append(
            {
                "name": reg["name"],
                "category_name": reg.get("category_name") or "",
                "wat_par": wat,
                "lu_par": lu,
                "source": source,
            }
        )

    items_out.sort(key=lambda r: r["name"].lower())
    payload = {
        "ok": True,
        "merchant_id": cfg.merchant_id,
        "items": items_out,
        "note": "Liquor par is fixed in Supabase liquor_par (not usage-based).",
        "from_cache": False,
    }
    _CACHE[cache_key] = (now, payload)
    return payload
