"""Disk + memory cache and request pacing for Clover API."""
from __future__ import annotations

import hashlib
import json
import threading
import time
from pathlib import Path
from typing import Any, Callable, TypeVar

ROOT = Path(__file__).resolve().parents[1]


def _default_cache_dir() -> Path:
    import os

    override = (os.getenv("CLOVER_CACHE_DIR") or "").strip()
    if override:
        return Path(override)
    if os.getenv("VERCEL") or os.getenv("VERCEL_ENV"):
        return Path("/tmp/clover-cache")
    return ROOT / "data" / "cache"


CACHE_DIR = _default_cache_dir()

# How long to reuse cached API results (hours). Override with CLOVER_CACHE_TTL_HOURS in .env
DEFAULT_CACHE_TTL_HOURS = 24

# Pause between paginated Clover requests (ms). Override with CLOVER_REQUEST_DELAY_MS
DEFAULT_REQUEST_DELAY_MS = 300

T = TypeVar("T")

_memory: dict[str, tuple[float, Any]] = {}
_locks: dict[str, threading.Lock] = {}
_global_lock = threading.Lock()


def cache_ttl_seconds() -> float:
    import os

    raw = (os.getenv("CLOVER_CACHE_TTL_HOURS") or "").strip()
    hours = float(raw) if raw else DEFAULT_CACHE_TTL_HOURS
    return max(hours, 0.25) * 3600


def request_delay_seconds() -> float:
    import os

    raw = (os.getenv("CLOVER_REQUEST_DELAY_MS") or "").strip()
    ms = float(raw) if raw else DEFAULT_REQUEST_DELAY_MS
    return max(ms, 0) / 1000.0


def _cache_path(key: str) -> Path:
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:32]
    return CACHE_DIR / f"{digest}.json"


def read_cache(key: str) -> dict[str, Any] | None:
    now = time.time()
    ttl = cache_ttl_seconds()

    mem = _memory.get(key)
    if mem and (now - mem[0]) < ttl:
        return mem[1]

    path = _cache_path(key)
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        cached_at = float(payload.get("cached_at", 0))
        if (now - cached_at) >= ttl:
            return None
        data = payload.get("data")
        if data is not None:
            _memory[key] = (cached_at, data)
        return data
    except (json.JSONDecodeError, OSError, TypeError, ValueError):
        return None


def write_cache(key: str, data: Any) -> None:
    now = time.time()
    _memory[key] = (now, data)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = _cache_path(key)
    path.write_text(
        json.dumps({"cached_at": now, "data": data}, indent=2),
        encoding="utf-8",
    )


def get_or_load(key: str, loader: Callable[[], T], *, force_refresh: bool = False) -> T:
    """Return cached value or call loader once per key (thread-safe)."""
    if not force_refresh:
        cached = read_cache(key)
        if cached is not None:
            return cached  # type: ignore[return-value]

    with _global_lock:
        if key not in _locks:
            _locks[key] = threading.Lock()
        key_lock = _locks[key]

    with key_lock:
        if not force_refresh:
            cached = read_cache(key)
            if cached is not None:
                return cached  # type: ignore[return-value]

        data = loader()
        write_cache(key, data)
        return data
