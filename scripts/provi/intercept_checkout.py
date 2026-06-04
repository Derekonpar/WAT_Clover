#!/usr/bin/env python3
"""
Capture Provi checkout API calls while you walk through the order flow.

Submit / place-order requests are BLOCKED by default (dry run).

  python3 scripts/provi/intercept_checkout.py
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from provi.browser import attach_debug_listeners, launch_provi_context, primary_page  # noqa: E402
from provi.capture import CaptureLog, is_interesting_url, is_likely_submit  # noqa: E402
from provi.paths import CAPTURE_DIR, PROVI_APP_URL, PROFILE_DIR, ensure_dirs  # noqa: E402


def _register_submit_block(page, capture: CaptureLog, block_submit: bool) -> None:
    """Block only likely submit calls — do NOT route all traffic (breaks SPA load)."""

    def maybe_block(route, request) -> None:
        if block_submit and is_likely_submit(
            request.url, request.method, request.post_data
        ):
            capture.add(
                phase="blocked_submit",
                method=request.method,
                url=request.url,
                request_headers=request.headers,
                post_data=request.post_data,
                blocked=True,
                note="Blocked by intercept_checkout.py (dry run)",
            )
            print(f"\n🛑 BLOCKED submit: {request.method} {request.url}\n")
            route.abort("failed")
            return
        route.continue_()

    # Narrow routes — capture still uses request/response listeners on the page
    for pattern in (
        "**/graphql**",
        "**/api/**",
        "**/*provi*/**",
        "**/order**",
        "**/checkout**",
    ):
        page.route(pattern, maybe_block)


def main() -> int:
    parser = argparse.ArgumentParser(description="Intercept Provi checkout API (dry run)")
    parser.add_argument(
        "--allow-submit",
        action="store_true",
        help="Do not block place-order requests (will actually submit)",
    )
    parser.add_argument(
        "--no-block",
        action="store_true",
        help="Capture only — never block API calls (use if notes/cart save acts broken)",
    )
    args = parser.parse_args()
    block_submit = not args.allow_submit and not args.no_block

    ensure_dirs()
    if not PROFILE_DIR.exists() or not any(PROFILE_DIR.iterdir()):
        print(
            "No Chrome profile yet. Run: python3 scripts/provi/setup_session.py\n"
            "(Re-run setup if you only saved session.json before — profile is required.)",
            file=sys.stderr,
        )
        return 1

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "Install playwright: python3 -m pip install playwright && "
            "python3 -m playwright install chrome",
            file=sys.stderr,
        )
        return 1

    capture = CaptureLog()
    pending: dict[str, dict] = {}

    print("Launching Chrome with saved Provi profile…")
    if block_submit:
        print("DRY RUN: final place-order POSTs will be BLOCKED.\n")
    elif args.no_block:
        print("CAPTURE ONLY: nothing blocked — do NOT click Place Order.\n")
    else:
        print("WARNING: --allow-submit is ON — orders may go through.\n")

    print(
        "In the browser:\n"
        "  0. Confirm location is **Wild Axe** (not On Par Entertainment)\n"
        "  1. Search/add catalog items by Provi product ID (e.g. 9232L)\n"
        "  2. Add **rep notes** at checkout (see below — not as a catalog SKU)\n"
        "  3. Proceed to Place Order (we block the final submit)\n"
        "  4. Press Enter in this terminal when done\n"
    )

    with sync_playwright() as p:
        context = launch_provi_context(p)
        page = primary_page(context)
        attach_debug_listeners(page)

        def on_request(request) -> None:
            if not is_interesting_url(request.url):
                return
            rid = request.url + request.method
            pending[rid] = {
                "method": request.method,
                "url": request.url,
                "headers": request.headers,
                "post_data": request.post_data,
            }

        def on_response(response) -> None:
            req = response.request
            if not is_interesting_url(req.url):
                return
            rid = req.url + req.method
            base = pending.pop(rid, {})
            body: str | None = None
            try:
                if "json" in (response.headers.get("content-type") or "").lower():
                    body = response.text()
            except Exception:
                body = None
            capture.add(
                phase="response",
                method=req.method,
                url=req.url,
                request_headers=base.get("headers") or req.headers,
                post_data=base.get("post_data") or req.post_data,
                status=response.status,
                response_headers=response.headers,
                response_body=body,
            )

        page.on("request", on_request)
        page.on("response", on_response)

        if block_submit:
            _register_submit_block(page, capture, block_submit)

        print(f"Navigating to {PROVI_APP_URL} …")
        page.goto(PROVI_APP_URL, wait_until="domcontentloaded", timeout=90_000)
        try:
            page.wait_for_load_state("networkidle", timeout=45_000)
        except Exception:
            print("Still loading (network busy) — if white screen persists, re-run setup_session.py")

        try:
            input(
                "\nWalk through checkout in the browser.\n"
                "Press Enter here when finished (browser will close)… "
            )
        except KeyboardInterrupt:
            print("\nInterrupted.")

        try:
            context.close()
        except Exception:
            pass

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = CAPTURE_DIR / f"checkout_{ts}.json"
    capture.save(out)

    print(f"\nCaptured {len(capture.events)} events ({len(capture.blocked)} blocked submit)")
    print(f"Saved → {out}")

    if capture.events:
        print("\nSample URLs captured:")
        seen: set[str] = set()
        for ev in capture.events:
            key = f"{ev['method']} {ev['url'].split('?')[0]}"
            if key not in seen:
                seen.add(key)
                print(f"  {key}")
            if len(seen) >= 15:
                print("  …")
                break
    else:
        print("No API events captured — try adding items and opening checkout.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
