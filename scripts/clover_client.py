"""Shared Clover API helpers for CLI and web dashboard."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from clover_cache import get_or_load, read_cache, request_delay_seconds, write_cache

ROOT = Path(__file__).resolve().parents[1]

# Clover inventory category name (exact match, case-insensitive). Override via CLOVER_SALES_CATEGORY in .env
DEFAULT_SALES_CATEGORY = "Beer"

# Canonical beer line items (dashboard allowlist). Edit config.yaml to change.
BEER_LINE_ITEMS: tuple[str, ...] = (
    "Angry Orchard",
    "Best Day IPA",
    "Blue Moon",
    "Boat Show (Yellow Springs)",
    "Bud Light",
    "Busch Light",
    "Coors Light",
    "Guinness",
    "Michelob Ultra",
    "Miller Lite",
    "Modelo",
    "Truth",
    "Yuengling",
)

BEVERAGE_CATEGORY_HINTS = (
    "beer",
    "liquor",
    "shot",
    "non-alcoholic",
    "wine",
    "cocktail",
    "drink",
    "seltzer",
    "cider",
)
FOOD_CATEGORY_HINTS = ("food", "snack", "appetizer", "entree", "meal")


@dataclass
class CloverConfig:
    base_url: str
    merchant_id: str
    token: str


def load_dotenv(path: Path | None = None) -> None:
    env_path = path or (ROOT / ".env")
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def get_config() -> CloverConfig:
    load_dotenv()
    token = (os.getenv("CLOVER_API_TOKEN") or "").strip()
    merchant_id = (os.getenv("CLOVER_MERCHANT_ID") or "").strip()
    base_url = (os.getenv("CLOVER_BASE_URL") or "https://api.clover.com").strip()
    if not token or not merchant_id:
        raise RuntimeError("Missing CLOVER_API_TOKEN or CLOVER_MERCHANT_ID in .env")
    return CloverConfig(base_url=base_url, merchant_id=merchant_id, token=token)


def now_utc_ms() -> int:
    return int(dt.datetime.now(dt.timezone.utc).timestamp() * 1000)


def to_utc_ms(day: dt.date, end_of_day: bool = False) -> int:
    t = dt.time(23, 59, 59, 999000) if end_of_day else dt.time(0, 0, 0)
    d = dt.datetime.combine(day, t, tzinfo=dt.timezone.utc)
    return int(d.timestamp() * 1000)


def parse_date(s: str) -> dt.date:
    return dt.date.fromisoformat(s)


def parse_last_week_range(today: dt.date | None = None) -> tuple[dt.date, dt.date]:
    today = today or dt.date.today()
    this_monday = today - dt.timedelta(days=today.weekday())
    last_monday = this_monday - dt.timedelta(days=7)
    last_sunday = this_monday - dt.timedelta(days=1)
    return last_monday, last_sunday


def clover_get(cfg: CloverConfig, path: str, query: dict | None = None, *, retries: int = 4) -> dict[str, Any]:
    url = f"{cfg.base_url.rstrip('/')}/v3/merchants/{cfg.merchant_id}/{path.lstrip('/')}"
    if query:
        url += "?" + urllib.parse.urlencode(query, doseq=True)

    last_err: Exception | None = None
    for attempt in range(retries):
        req = urllib.request.Request(url)
        req.add_header("Authorization", f"Bearer {cfg.token}")
        req.add_header("Accept", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                return json.loads(resp.read().decode("utf-8", errors="replace"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            if e.code == 429 and attempt < retries - 1:
                wait = 2 ** (attempt + 1)
                retry_after = e.headers.get("Retry-After")
                if retry_after and retry_after.isdigit():
                    wait = max(wait, int(retry_after))
                time.sleep(wait)
                last_err = e
                continue
            raise RuntimeError(f"Clover API {e.code}: {body[:300]}") from e
        except Exception as e:
            last_err = e
            if attempt < retries - 1:
                time.sleep(2 ** (attempt + 1))
                continue
            raise

    if last_err:
        raise last_err
    raise RuntimeError("Clover API request failed")


def paginate_elements(
    cfg: CloverConfig,
    path: str,
    query: dict | None = None,
    *,
    page_size: int = 100,
    max_pages: int = 50,
) -> list[dict[str, Any]]:
    query = dict(query or {})
    query["limit"] = str(page_size)
    offset = 0
    all_rows: list[dict[str, Any]] = []

    delay = request_delay_seconds()
    for page in range(max_pages):
        if page > 0 and delay:
            time.sleep(delay)
        query["offset"] = str(offset)
        data = clover_get(cfg, path, query)
        rows = data.get("elements") or []
        if not rows:
            break
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += len(rows)

    return all_rows


def sales_category_filter() -> str:
    return (os.getenv("CLOVER_SALES_CATEGORY") or DEFAULT_SALES_CATEGORY).strip()


def allowed_beer_line_items() -> tuple[str, ...]:
    """Load fixed beer SKU list from config.yaml beer_line_items section if present."""
    config_path = ROOT / "config.yaml"
    if not config_path.exists():
        return BEER_LINE_ITEMS
    items: list[str] = []
    in_section = False
    for line in config_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped == "beer_line_items:":
            in_section = True
            continue
        if in_section:
            if stripped.startswith("- "):
                items.append(stripped[2:].strip())
                continue
            if stripped and not stripped.startswith("#"):
                break
    return tuple(items) if items else BEER_LINE_ITEMS


def canonical_beer_name(line_name: str) -> str | None:
    """Map a Clover line-item name to a canonical beer SKU, or None if not allowed."""
    raw = (line_name or "").strip()
    if not raw:
        return None
    lower = raw.lower()
    for canonical in allowed_beer_line_items():
        if canonical.lower() == lower:
            return canonical
    return None


def empty_beer_rows() -> dict[str, dict[str, Any]]:
    filt = sales_category_filter()
    return {
        name.lower(): {
            "name": name,
            "category": "beer",
            "category_name": filt,
            "quantity_sold": 0,
            "gross_minor_units": 0,
            "line_count": 0,
        }
        for name in allowed_beer_line_items()
    }


def matches_sales_category(category_name: str, category_filter: str | None = None) -> bool:
    """True when line item's Clover category name matches the configured filter (e.g. Beer)."""
    filt = (category_filter or sales_category_filter()).strip().lower()
    return (category_name or "").strip().lower() == filt


def classify_category_name(name: str) -> str:
    n = (name or "").strip().lower()
    if not n:
        return "other"
    if any(h in n for h in FOOD_CATEGORY_HINTS):
        return "food"
    if any(h in n for h in BEVERAGE_CATEGORY_HINTS):
        return "beverage"
    return "other"


def fetch_categories(cfg: CloverConfig) -> list[dict[str, Any]]:
    data = clover_get(cfg, "categories", {"limit": "100"})
    return data.get("elements") or []


def build_beer_item_map(
    cfg: CloverConfig,
    category_filter: str,
    *,
    force_refresh: bool = False,
) -> dict[str, dict[str, str]]:
    """Beer (or configured category) items only — cached to avoid repeated catalog pulls."""

    def _load() -> dict[str, dict[str, str]]:
        mapping: dict[str, dict[str, str]] = {}
        items = paginate_elements(cfg, "items", {"expand": "categories"}, page_size=100, max_pages=30)
        for item in items:
            item_id = item.get("id")
            if not item_id:
                continue
            item_name = (item.get("name") or "").strip()
            categories = (item.get("categories") or {}).get("elements") or []
            cat_name = (categories[0].get("name") or "").strip() if categories else ""
            if not matches_sales_category(cat_name, category_filter):
                continue
            mapping[item_id] = {
                "category": "beer",
                "category_name": cat_name,
                "item_name": item_name,
            }
        return mapping

    cache_key = f"beer_items:{cfg.merchant_id}:{category_filter.strip().lower()}"
    return get_or_load(cache_key, _load, force_refresh=force_refresh)


def fetch_orders_in_range(
    cfg: CloverConfig,
    start_ms: int,
    end_ms: int,
    *,
    page_size: int = 100,
) -> list[dict[str, Any]]:
    return paginate_elements(
        cfg,
        "orders",
        {
            "expand": "lineItems",
            "filter": [f"createdTime>={start_ms}", f"createdTime<={end_ms}"],
        },
        page_size=page_size,
    )


def extract_line_items(order: dict[str, Any]) -> list[dict[str, Any]]:
    li = order.get("lineItems") or {}
    elements = li.get("elements") if isinstance(li, dict) else []
    return elements or []


def aggregate_line_items(
    orders: list[dict[str, Any]],
    *,
    category_filter: str | None = None,
) -> dict[str, Any]:
    """Aggregate sales for the fixed 13 beer line-item names only (exact name match)."""
    filt = category_filter or sales_category_filter()
    by_name = empty_beer_rows()

    for order in orders:
        for line in extract_line_items(order):
            canonical = canonical_beer_name(line.get("name") or "")
            if not canonical:
                continue

            qty = int(line.get("unitQty") or line.get("quantity") or 1)
            line_total = line.get("price") or line.get("total") or line.get("priceWithTax") or 0
            try:
                line_total = int(line_total)
            except (TypeError, ValueError):
                line_total = 0

            row = by_name[canonical.lower()]
            row["quantity_sold"] += qty
            row["gross_minor_units"] += line_total
            row["line_count"] += 1

    items = sorted(by_name.values(), key=lambda r: r["name"].lower())
    beer_list = allowed_beer_line_items()

    totals = {
        "quantity_sold": sum(i["quantity_sold"] for i in items),
        "gross_minor_units": sum(i["gross_minor_units"] for i in items),
        "unique_items": len(items),
    }
    return {
        "items": items,
        "clover_category": filt,
        "beer_sku_count": len(beer_list),
        "beer_line_items": list(beer_list),
        "totals": totals,
    }


def _sales_cache_key(cfg: CloverConfig, category_filter: str, start_d: dt.date, end_d: dt.date) -> str:
    names_key = "|".join(allowed_beer_line_items())
    digest = hashlib.sha256(names_key.encode("utf-8")).hexdigest()[:12]
    return (
        f"sales_v3:{cfg.merchant_id}:{category_filter.strip().lower()}:"
        f"{digest}:{start_d.isoformat()}:{end_d.isoformat()}"
    )


def fetch_sales_report(
    start_date: str,
    end_date: str,
    *,
    force_refresh: bool = False,
) -> dict[str, Any]:
    cfg = get_config()
    start_d = parse_date(start_date)
    end_d = parse_date(end_date)
    if end_d < start_d:
        raise ValueError("end_date must be on or after start_date")

    category_filter = sales_category_filter()
    cache_key = _sales_cache_key(cfg, category_filter, start_d, end_d)

    if not force_refresh:
        cached = read_cache(cache_key)
        if cached is not None:
            cached = dict(cached)
            cached["from_cache"] = True
            return cached

    start_ms = to_utc_ms(start_d, end_of_day=False)
    end_ms = to_utc_ms(end_d, end_of_day=True)

    orders = fetch_orders_in_range(cfg, start_ms, end_ms)
    summary = aggregate_line_items(orders, category_filter=category_filter)

    report = {
        "merchant_id": cfg.merchant_id,
        "time_range": {
            "start_date": str(start_d),
            "end_date": str(end_d),
            "start_ms": start_ms,
            "end_ms": end_ms,
        },
        "generated_at_utc_ms": now_utc_ms(),
        "from_cache": False,
        "api_calls_note": "Fresh Clover pull; cached until dates change or Refresh.",
        **summary,
    }
    write_cache(cache_key, {k: v for k, v in report.items() if k != "from_cache"})
    return report
