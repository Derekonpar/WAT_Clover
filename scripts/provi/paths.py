"""Paths for Provi automation (session + API captures)."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROVI_DIR = Path(os.getenv("PROVI_AGENT_DIR", ROOT / "data" / "provi")).expanduser()
SESSION_FILE = PROVI_DIR / "session.json"
PROFILE_DIR = PROVI_DIR / "chrome-profile"
CAPTURE_DIR = PROVI_DIR / "captures"

PROVI_APP_URL = os.getenv("PROVI_APP_URL", "https://app.provi.com/").rstrip("/") + "/"
# Liquor orders must be under Wild Axe (not On Par Entertainment).
PROVI_LOCATION_NAME = os.getenv("PROVI_LOCATION_NAME", "Wild Axe")
# Provi internal retailer id for Wild Axe Throwing (On Par = 402312).
PROVI_RETAILER_ID = os.getenv("PROVI_RETAILER_ID", "403032")
# OHLQ account # shown in Provi for Wild Axe Throwing (On Par uses a different number).
PROVI_OHLQ_ACCOUNT_NUMBER = os.getenv("PROVI_OHLQ_ACCOUNT_NUMBER", "9609977")
# Set to false locally to build carts without placing orders.
PROVI_ALLOW_SUBMIT = os.getenv("PROVI_ALLOW_SUBMIT", "true").lower() in ("1", "true", "yes")


def ensure_dirs() -> None:
    PROVI_DIR.mkdir(parents=True, exist_ok=True)
    CAPTURE_DIR.mkdir(parents=True, exist_ok=True)
