#!/usr/bin/env python3
"""Print a summary of a Provi intercept capture JSON."""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("capture", type=Path, help="Path to checkout_*.json")
    args = parser.parse_args()
    data = json.loads(args.capture.read_text(encoding="utf-8"))
    events = data.get("events") or []

    print(f"Events: {len(events)}  Blocked: {data.get('blocked_count', 0)}")
    print(f"Captured: {data.get('captured_at')}\n")

    by_method_url: Counter[str] = Counter()
    posts: list[dict] = []
    for ev in events:
        key = f"{ev.get('method')} {ev.get('url', '').split('?')[0]}"
        by_method_url[key] += 1
        if ev.get("method") in {"POST", "PUT", "PATCH"}:
            posts.append(ev)

    print("=== Endpoints (top) ===")
    for key, n in by_method_url.most_common(25):
        print(f"  [{n}x] {key}")

    print("\n=== POST/PUT/PATCH bodies (sample) ===")
    for ev in posts[:12]:
        print(f"\n{ev.get('method')} {ev.get('url')}")
        if ev.get("blocked"):
            print("  ** BLOCKED **")
        if ev.get("post_data"):
            body = ev["post_data"]
            print(f"  body: {body[:500]}{'…' if len(body) > 500 else ''}")
        if ev.get("status"):
            print(f"  status: {ev['status']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
