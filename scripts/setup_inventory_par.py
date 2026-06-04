#!/usr/bin/env python3
"""
One-shot inventory par setup (run after Supabase credentials are in .env):

  1. Test Supabase connection (usage_weekly + liquor_par tables)
  2. Sync last 8 weeks of Clover usage → usage_weekly (uses cache; no refresh unless --refresh)
  3. Seed liquor_par from docs/liquor-par-build.yaml
  4. Print beer 6-week average par summary

Usage:
  python3 scripts/setup_inventory_par.py
  python3 scripts/setup_inventory_par.py --refresh   # bypass Clover cache when syncing
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from clover_client import allowed_beer_line_items, get_config
from liquor_par_yaml import load_liquor_par_build_file
from seed_liquor_par import main as seed_liquor_main
from seed_beer_pack_sizes import main as seed_beer_packs_main
from supabase_client import supabase_key, supabase_url, test_connection
from usage_sync import suggested_par_from_supabase, sync_weeks_to_supabase


def _require_supabase_env() -> None:
    if not supabase_url() or not supabase_key():
        raise RuntimeError(
            "Supabase not configured. Add to .env:\n"
            "  SUPABASE_URL=https://YOUR_PROJECT.supabase.co\n"
            "  SUPABASE_SERVICE_ROLE_KEY=...\n"
            "Then run: python3 scripts/setup_inventory_par.py"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Set up beer + liquor inventory par in Supabase")
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Bypass Clover cache when syncing usage (more API calls)",
    )
    parser.add_argument("--weeks", type=int, default=8, help="Weeks of usage to sync (default 8)")
    parser.add_argument("--skip-sync", action="store_true", help="Skip Clover → usage_weekly sync")
    parser.add_argument("--skip-seed", action="store_true", help="Skip liquor_par seed")
    args = parser.parse_args()

    _require_supabase_env()
    cfg = get_config()

    print("=== Supabase health ===")
    health = test_connection()
    print(health.get("message", health))
    if health.get("needs_migration"):
        print(
            "\nRun migrations in Supabase SQL editor:\n"
            "  supabase/migrations/001_usage_weekly.sql\n"
            "  supabase/migrations/002_liquor_par.sql\n"
        )
        return 1

    if not args.skip_sync:
        print(f"\n=== Syncing {args.weeks} weeks to usage_weekly (refresh={args.refresh}) ===")
        sync_result = sync_weeks_to_supabase(
            args.weeks,
            force_refresh=args.refresh,
        )
        print(
            f"Synced {sync_result.get('rows_upserted', 0)} rows across "
            f"{len(sync_result.get('weeks_synced') or [])} week(s)."
        )

    if not args.skip_seed:
        build = load_liquor_par_build_file()
        n = len([v for v in (build.get("items") or {}).values() if (v.get("wat") or 0) > 0 or (v.get("lu") or 0) > 0])
        print(f"\n=== Seeding liquor_par ({n} items with par > 0) ===")
        seed_liquor_main()

    print("\n=== Seeding beer_pack_size ===")
    seed_beer_packs_main()

    print("\n=== Beer par (6-week average, read-only in UI) ===")
    beer_par = suggested_par_from_supabase(6, force_refresh=True)
    by_name = {i["name"]: i for i in beer_par.get("items") or []}
    for beer in allowed_beer_line_items():
        row = by_name.get(beer)
        if row:
            print(
                f"  {beer}: par {row['wat_par']} "
                f"(avg {row.get('avg_weekly', 0)}/wk, {row.get('weeks_with_data', 0)} weeks data)"
            )
        else:
            print(f"  {beer}: (no Supabase data — config fallback)")

    print("\nDone. Open the dashboard inventory tabs; par loads from Supabase only.")
    print("Edit docs/liquor-par-build.yaml and re-run this script when build-to-par changes.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as e:
        print(f"\nError: {e}", file=sys.stderr)
        raise SystemExit(1) from e
