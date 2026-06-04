#!/usr/bin/env python3
"""Upsert liquor_provi_product rows from fallback map."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from clover_client import get_config
from liquor_provi_map import _FALLBACK
from supabase_client import get_supabase


def main() -> int:
    cfg = get_config()
    client = get_supabase()
    rows = [
        {
            "merchant_id": cfg.merchant_id,
            "item_name": name,
            "provi_product_id": meta.get("provi_product_id"),
            "order_via": meta.get("order_via", "catalog"),
        }
        for name, meta in sorted(_FALLBACK.items(), key=lambda x: x[0].lower())
    ]
    client.table("liquor_provi_product").upsert(
        rows, on_conflict="merchant_id,item_name"
    ).execute()
    print(f"Upserted {len(rows)} liquor_provi_product row(s) for merchant {cfg.merchant_id}.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        raise SystemExit(1) from e
