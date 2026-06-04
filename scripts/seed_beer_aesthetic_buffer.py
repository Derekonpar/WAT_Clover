#!/usr/bin/env python3
"""Upsert beer_aesthetic_buffer rows (36 for Michelob/Miller/Modelo, 18 for others)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from beer_buffer import _DEFAULT_BUFFER, _HIGH_BUFFER, _HIGH_BUFFER_BEERS
from clover_client import allowed_beer_line_items, get_config
from supabase_client import get_supabase


def main() -> int:
    cfg = get_config()
    client = get_supabase()
    rows = []
    for beer in allowed_beer_line_items():
        n = _HIGH_BUFFER if beer.lower() in _HIGH_BUFFER_BEERS else _DEFAULT_BUFFER
        rows.append(
            {
                "merchant_id": cfg.merchant_id,
                "beer_name": beer,
                "wat_buffer": n,
                "lu_buffer": n,
            }
        )
    client.table("beer_aesthetic_buffer").upsert(
        rows, on_conflict="merchant_id,beer_name"
    ).execute()
    print(
        f"Upserted {len(rows)} beer_aesthetic_buffer row(s) for merchant {cfg.merchant_id}."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        raise SystemExit(1) from e
