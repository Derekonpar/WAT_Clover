#!/usr/bin/env python3
"""
Run after each Saturday (e.g. cron: 59 23 * * 6) to sync the last Sun–Sat week
to Supabase and refresh beer par before Sunday orders.

Example crontab (server local time):
  59 23 * * 6 cd /path/to/clover-sales-agent && ./.venv/bin/python scripts/cron_weekly_beer_sync.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from usage_sync import update_beer_par_for_orders  # noqa: E402


def main() -> int:
    result = update_beer_par_for_orders(force_refresh=True)
    print(json.dumps(result, indent=2, default=str))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
