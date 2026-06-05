"""Shared helpers for Provi network capture."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

# Domains / path hints worth logging (skip static assets).
INTERESTING_URL_HINTS = (
    "api.",
    "app.provi.com",
    "provi.com/api",
    "graphql",
    "sevenfifty",
    "ohlq",
    "/cart",
    "/checkout",
    "/order",
    "/basket",
    "/line",
    "/product",
    "/search",
)

# Block only likely final submit — not add-to-cart.
SUBMIT_BLOCK_PATTERNS = (
    re.compile(r"place[-_]?order", re.I),
    re.compile(r"submit[-_]?order", re.I),
    re.compile(r"/cart/submit", re.I),
    re.compile(r"/orders/[^/?]+/submit", re.I),
    re.compile(r"/checkout/[^/?]+/submit", re.I),
    re.compile(r"/checkout/submit", re.I),
    re.compile(r"/order/submit", re.I),
)


def is_interesting_url(url: str) -> bool:
    lower = url.lower()
    return any(h in lower for h in INTERESTING_URL_HINTS)


def is_likely_submit(url: str, method: str, post_data: str | None = None) -> bool:
    if method.upper() not in {"POST", "PUT", "PATCH"}:
        return False
    if any(p.search(url) for p in SUBMIT_BLOCK_PATTERNS):
        return True
    if not post_data:
        return False
    lower = post_data.lower()
    # GraphQL / JSON operation names often used at checkout
    submit_hints = (
        "submitorder",
        "placeorder",
        "confirmorder",
        "finalizeorder",
        "completecheckout",
        "checkoutsubmit",
    )
    if any(h in lower for h in submit_hints):
        return True
    return False


def redact_headers(headers: dict[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in headers.items():
        kl = k.lower()
        if kl in {"authorization", "cookie", "x-api-key"}:
            out[k] = (v[:12] + "…") if len(v) > 12 else "…"
        else:
            out[k] = v
    return out


def truncate(text: str | None, limit: int = 8000) -> str | None:
    if text is None:
        return None
    if len(text) <= limit:
        return text
    return text[:limit] + f"\n… [truncated {len(text) - limit} chars]"


class CaptureLog:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []
        self.blocked: list[dict[str, Any]] = []

    def add(
        self,
        *,
        phase: str,
        method: str,
        url: str,
        request_headers: dict[str, str] | None = None,
        post_data: str | None = None,
        status: int | None = None,
        response_headers: dict[str, str] | None = None,
        response_body: str | None = None,
        blocked: bool = False,
        note: str | None = None,
    ) -> None:
        entry = {
            "at": datetime.now(timezone.utc).isoformat(),
            "phase": phase,
            "method": method,
            "url": url,
            "blocked": blocked,
        }
        if note:
            entry["note"] = note
        if request_headers is not None:
            entry["request_headers"] = redact_headers(request_headers)
        if post_data is not None:
            entry["post_data"] = truncate(post_data)
        if status is not None:
            entry["status"] = status
        if response_headers is not None:
            entry["response_headers"] = redact_headers(response_headers)
        if response_body is not None:
            entry["response_body"] = truncate(response_body)
        self.events.append(entry)
        if blocked:
            self.blocked.append(entry)

    def save(self, path) -> None:
        from pathlib import Path as PathLib

        payload = {
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "event_count": len(self.events),
            "blocked_count": len(self.blocked),
            "events": self.events,
        }
        p = PathLib(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(payload, indent=2), encoding="utf-8")
