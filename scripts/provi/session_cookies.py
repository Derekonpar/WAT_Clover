"""Load Provi session cookies for API requests."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any
from urllib.parse import unquote

from provi.paths import PROFILE_DIR, PROVI_RETAILER_ID, SESSION_FILE, ensure_dirs

RETAILER_CONTEXT_STORAGE_KEY = "X-Tiz-Last-Retailer-Context"


def _cookies_from_storage_state(data: dict[str, Any]) -> list[dict[str, Any]]:
    return list(data.get("cookies") or [])


def load_session_storage(*, session_file: Path | None = None) -> dict[str, Any]:
    path = session_file or SESSION_FILE
    data = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, Any] = {"cookies": _cookies_from_storage_state(data), "origins": data.get("origins") or []}
    return out


def retailer_context_from_session(*, session_file: Path | None = None) -> str | None:
    """
    Provi scopes API calls by X-Tiz-Retailer-Context (stored in browser localStorage).
    Without this header, requests default to On Par even if the UI shows Wild Axe.
    """
    env = os.getenv("PROVI_RETAILER_ID", "").strip()
    if env:
        return env

    path = session_file or SESSION_FILE
    if not path.exists():
        return PROVI_RETAILER_ID or None

    data = json.loads(path.read_text(encoding="utf-8"))
    for origin in data.get("origins") or []:
        if "provi.com" not in (origin.get("origin") or ""):
            continue
        for item in origin.get("localStorage") or []:
            if item.get("name") == RETAILER_CONTEXT_STORAGE_KEY:
                value = str(item.get("value") or "").strip()
                if value:
                    return value

    return PROVI_RETAILER_ID or None


def load_session_cookies(*, session_file: Path | None = None) -> list[dict[str, Any]]:
    path = session_file or SESSION_FILE
    if not path.exists():
        raise RuntimeError(
            f"No Provi session at {path}. Run: python3 scripts/provi/setup_session.py"
        )
    data = json.loads(path.read_text(encoding="utf-8"))
    cookies = _cookies_from_storage_state(data)
    if not cookies:
        raise RuntimeError(f"Session file {path} has no cookies.")
    return cookies


def cookies_for_domain(cookies: list[dict[str, Any]], domain: str = "app.provi.com") -> dict[str, str]:
    out: dict[str, str] = {}
    for c in cookies:
        d = (c.get("domain") or "").lstrip(".")
        if domain in d or d in domain:
            out[c["name"]] = c["value"]
    return out


def xsrf_token(cookie_jar: dict[str, str]) -> str | None:
    raw = cookie_jar.get("XSRF-TOKEN")
    if not raw:
        return None
    return unquote(raw)


def export_session_from_profile() -> Path:
    """Refresh session.json from persistent Chrome profile (extends cookie TTL)."""
    ensure_dirs()
    if not PROFILE_DIR.exists():
        raise RuntimeError(f"No Chrome profile at {PROFILE_DIR}. Run setup_session.py first.")
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        raise RuntimeError("Install playwright: pip install playwright") from e

    from provi.browser import launch_provi_context, primary_page
    from provi.paths import PROVI_APP_URL

    with sync_playwright() as p:
        context = launch_provi_context(p)
        page = primary_page(context)
        page.goto(PROVI_APP_URL, wait_until="domcontentloaded", timeout=90_000)
        context.storage_state(path=str(SESSION_FILE))
        context.close()
    return SESSION_FILE
