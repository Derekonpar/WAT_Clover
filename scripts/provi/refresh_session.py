#!/usr/bin/env python3
"""Refresh data/provi/session.json from Chrome profile (extends cookie life)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from provi.session_cookies import export_session_from_profile  # noqa: E402


def main() -> int:
    path = export_session_from_profile()
    print(f"Refreshed session → {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
