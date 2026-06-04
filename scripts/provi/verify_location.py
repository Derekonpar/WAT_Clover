#!/usr/bin/env python3
"""Check that the saved Provi session is on Wild Axe (not On Par)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from provi.client import ProviApiError, ProviClient  # noqa: E402
from provi.paths import PROVI_LOCATION_NAME, PROVI_OHLQ_ACCOUNT_NUMBER, PROVI_RETAILER_ID  # noqa: E402


def main() -> int:
    try:
        ctx = ProviClient().assert_expected_location()
    except ProviApiError as e:
        print(f"NOT READY — {e}")
        return 1

    name = ctx.get("retailer_name") or "(no open cart — OHLQ account checked)"
    print("OK — Provi session is on the correct location.")
    print(f"  Expected: {PROVI_LOCATION_NAME} · retailer {PROVI_RETAILER_ID} · OHLQ {PROVI_OHLQ_ACCOUNT_NUMBER}")
    print(f"  API header: X-Tiz-Retailer-Context={ctx.get('retailer_context_header')}")
    print(f"  OHLQ account: {ctx.get('ohlq_account_number')}")
    print(f"  Retailer id: {ctx.get('retailer_id')}")
    print(f"  Retailer name: {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
