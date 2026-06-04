#!/usr/bin/env python3
"""Print minimal Provi cookie JSON for Vercel env var PROVI_COOKIES_JSON."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from provi.session_cookies import cookies_for_domain, load_session_cookies  # noqa: E402

KEEP = {"_tiz_session", "XSRF-TOKEN", "user.id"}


def main() -> int:
    cookies = load_session_cookies()
    jar = cookies_for_domain(cookies)
    picked = [{"name": k, "value": v} for k, v in jar.items() if k in KEEP]
    if not picked:
        print("No essential Provi cookies found. Run setup_session.py first.", file=sys.stderr)
        return 1
    payload = json.dumps(picked, separators=(",", ":"))
    print("Add this to Vercel (Settings → Environment Variables):")
    print("  PROVI_COOKIES_JSON")
    print("  PROVI_RETAILER_ID=403032")
    print("  PROVI_OHLQ_ACCOUNT_NUMBER=9609977")
    print()
    print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
