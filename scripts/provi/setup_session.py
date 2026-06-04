#!/usr/bin/env python3
"""
Save Provi login using a persistent Chrome profile (recommended).

The profile folder is reused by intercept_checkout.py — avoids Auth0 white screen.

  python3 scripts/provi/setup_session.py

Profile: data/provi/chrome-profile/
Backup:  data/provi/session.json
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from provi.browser import attach_debug_listeners, launch_provi_context, primary_page  # noqa: E402
from provi.paths import PROVI_APP_URL, SESSION_FILE, ensure_dirs  # noqa: E402


def main() -> int:
    ensure_dirs()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "Playwright not installed. Run:\n"
            "  python3 -m pip install playwright\n"
            "  python3 -m playwright install chrome",
            file=sys.stderr,
        )
        return 1

    print(f"Opening Provi at {PROVI_APP_URL}")
    print("Using persistent Chrome profile (data/provi/chrome-profile/).")
    print("1. Log in if needed")
    print("2. Switch location to **Wild Axe Throwing** (not On Par Entertainment)")
    print("   Tip: top-left / account menu → pick Wild Axe Throwing")
    print("3. Wait until the dashboard fully loads, then press Enter here.")
    print("4. After saving, verify with: python3 scripts/provi/verify_location.py\n")

    with sync_playwright() as p:
        context = launch_provi_context(p)
        page = primary_page(context)
        attach_debug_listeners(page)

        page.goto(PROVI_APP_URL, wait_until="domcontentloaded", timeout=90_000)
        try:
            page.wait_for_load_state("networkidle", timeout=30_000)
        except Exception:
            pass

        input("Press Enter after Wild Axe is selected and the app has loaded… ")

        try:
            context.storage_state(path=str(SESSION_FILE))
        except Exception as e:
            print(f"Note: could not write session backup ({e})")

        context.close()

    print(f"Session backup → {SESSION_FILE}")
    print("\nVerifying Wild Axe location…")
    try:
        from provi.client import ProviClient

        ctx = ProviClient().assert_expected_location()
        print(
            f"Verified: retailer {ctx.get('retailer_id')} · "
            f"OHLQ {ctx.get('ohlq_account_number')}"
        )
    except Exception as e:
        print(f"WARNING: location check failed — {e}")
        print("Re-open setup, switch to Wild Axe Throwing, press Enter again.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
