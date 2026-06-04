#!/usr/bin/env python3
"""Upsert beer_pack_size rows (defaults from distributor pack rules)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from beer_pack import _FALLBACK
from clover_client import get_config
from supabase_client import get_supabase


def main() -> int:
    cfg = get_config()
    client = get_supabase()
    rows = [
        {
            "merchant_id": cfg.merchant_id,
            "beer_name": beer,
            "distributor_id": dist,
            "pack_size": size,
        }
        for beer, (dist, size) in _FALLBACK.items()
    ]
    client.table("beer_pack_size").upsert(rows, on_conflict="merchant_id,beer_name").execute()
    print(f"Upserted {len(rows)} beer_pack_size row(s) for merchant {cfg.merchant_id}.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        raise SystemExit(1) from e
