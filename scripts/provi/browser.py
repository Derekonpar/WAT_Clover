"""Launch Chrome for Provi — persistent profile avoids Auth0 white-screen on reload."""
from __future__ import annotations

from typing import Any

from provi.paths import PROFILE_DIR, ensure_dirs

CHROME_ARGS = (
    "--disable-blink-features=AutomationControlled",
    "--no-first-run",
    "--no-default-browser-check",
)


def launch_provi_context(playwright: Any):
    """
    Always use a persistent Chrome profile (data/provi/chrome-profile/).
    Same profile for setup + intercept — do not rely on storage_state alone.
    """
    ensure_dirs()
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    launch_kwargs: dict[str, Any] = {
        "user_data_dir": str(PROFILE_DIR),
        "headless": False,
        "args": list(CHROME_ARGS),
        "viewport": {"width": 1400, "height": 900},
        "ignore_default_args": ["--enable-automation"],
    }

    try:
        return playwright.chromium.launch_persistent_context(
            channel="chrome",
            **launch_kwargs,
        )
    except Exception as e:
        print(f"Chrome not available ({e}) — using Chromium.")
        return playwright.chromium.launch_persistent_context(**launch_kwargs)


def primary_page(context) -> Any:
    if context.pages:
        return context.pages[0]
    return context.new_page()


def attach_debug_listeners(page) -> None:
    page.on("console", lambda msg: print(f"[browser] {msg.type}: {msg.text[:200]}"))
    page.on("pageerror", lambda err: print(f"[browser] pageerror: {err}"))
