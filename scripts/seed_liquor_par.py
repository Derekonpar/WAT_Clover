#!/usr/bin/env python3
"""Upsert liquor_par rows from docs/liquor-par-build.yaml into Supabase."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from clover_client import get_config
from liquor_par_yaml import load_liquor_par_build_file
from supabase_client import get_supabase


def main() -> int:
    data = load_liquor_par_build_file()
    items: dict[str, dict[str, int]] = data.get("items") or {}
    if not items:
        print("No items in docs/liquor-par-build.yaml")
        return 1

    cfg = get_config()
    merchant_id = data.get("merchant_id") or cfg.merchant_id
    client = get_supabase()

    rows = []
    skipped = 0
    for name, pars in sorted(items.items(), key=lambda x: x[0].lower()):
        wat = int(pars.get("wat") or 0)
        lu = int(pars.get("lu") or 0)
        if wat <= 0 and lu <= 0:
            skipped += 1
            continue
        rows.append(
            {
                "merchant_id": merchant_id,
                "item_name": name,
                "wat_par": wat,
                "lu_par": lu,
            }
        )

    if not rows:
        print("Nothing to upsert (all items have wat/lu 0). Edit docs/liquor-par-build.yaml.")
        return 1

    result = client.table("liquor_par").upsert(rows, on_conflict="merchant_id,item_name").execute()
    count = len(result.data or rows)
    print(f"Upserted {count} liquor_par row(s) for merchant {merchant_id} (skipped {skipped} with par 0).")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        raise SystemExit(1) from e
