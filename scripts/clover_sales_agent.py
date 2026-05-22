#!/usr/bin/env python3
import argparse
import csv
import datetime as dt
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path


def now_utc_ms() -> int:
    return int(dt.datetime.now(dt.timezone.utc).timestamp() * 1000)


def to_utc_ms(day: dt.date, end_of_day: bool = False) -> int:
    t = dt.time(23, 59, 59, 999000) if end_of_day else dt.time(0, 0, 0)
    d = dt.datetime.combine(day, t, tzinfo=dt.timezone.utc)
    return int(d.timestamp() * 1000)


def parse_date(s: str) -> dt.date:
    return dt.date.fromisoformat(s)


def parse_last_week_range(today: dt.date):
    # previous Monday..Sunday in UTC calendar
    this_monday = today - dt.timedelta(days=today.weekday())
    last_monday = this_monday - dt.timedelta(days=7)
    last_sunday = this_monday - dt.timedelta(days=1)
    return last_monday, last_sunday


def clover_get(base_url: str, merchant_id: str, token: str, path: str, query: dict):
    url = f"{base_url.rstrip('/')}/v3/merchants/{merchant_id}/{path.lstrip('/')}"
    if query:
        url += "?" + urllib.parse.urlencode(query, doseq=True)
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/json")
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode("utf-8", errors="replace")
        return json.loads(body)


def fetch_orders(base_url: str, merchant_id: str, token: str, start_ms: int, end_ms: int, limit: int = 200):
    # Clover filtering syntax can vary across accounts/versions.
    # We attempt createdTime range + expand lineItems.
    query = {
        "limit": str(limit),
        "expand": "lineItems",
        "filter": [f"createdTime>={start_ms}", f"createdTime<={end_ms}"],
    }
    data = clover_get(base_url, merchant_id, token, "orders", query)
    return data.get("elements", []), data


def extract_line_items(order: dict):
    li = order.get("lineItems") or {}
    elements = li.get("elements") if isinstance(li, dict) else []
    return elements or []


def aggregate_item_sales(orders, item_name: str, contains_match: bool = True):
    pat = re.compile(re.escape(item_name), re.IGNORECASE)
    quantity = 0
    gross_minor = 0
    matches = []

    for order in orders:
        oid = order.get("id")
        for line in extract_line_items(order):
            name = (line.get("name") or "").strip()
            if not name:
                continue
            ok = bool(pat.search(name)) if contains_match else (name.lower() == item_name.lower())
            if not ok:
                continue

            qty = int(line.get("unitQty") or line.get("quantity") or 1)
            # Clover often uses integer cents in fields like price/total/priceWithTax
            line_total = line.get("price") or line.get("total") or line.get("priceWithTax") or 0
            try:
                line_total = int(line_total)
            except Exception:
                line_total = 0

            quantity += qty
            gross_minor += line_total
            matches.append({
                "order_id": oid,
                "line_item_id": line.get("id"),
                "name": name,
                "qty": qty,
                "line_total_minor": line_total,
            })

    return {
        "item_name_query": item_name,
        "matched_line_items": len(matches),
        "quantity_sold": quantity,
        "gross_minor_units": gross_minor,
        "matches": matches,
    }


def write_outputs(output_dir: Path, prefix: str, summary: dict):
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / f"{prefix}.json"
    csv_path = output_dir / f"{prefix}.csv"

    with json_path.open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    rows = summary.get("matches", [])
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["order_id", "line_item_id", "name", "qty", "line_total_minor"],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    return str(json_path), str(csv_path)


def main():
    p = argparse.ArgumentParser(description="Clover beverage sales agent (read-only)")
    p.add_argument("--item", required=True, help="Item name to search, e.g. 'Michelob Ultra'")
    p.add_argument("--start-date", help="YYYY-MM-DD (UTC)")
    p.add_argument("--end-date", help="YYYY-MM-DD (UTC)")
    p.add_argument("--last-week", action="store_true", help="Use previous Monday..Sunday")
    p.add_argument("--exact", action="store_true", help="Exact item-name match instead of contains")
    p.add_argument("--output-dir", default="data", help="Output directory")
    args = p.parse_args()

    base_url = os.getenv("CLOVER_BASE_URL", "https://api.clover.com")
    token = os.getenv("CLOVER_API_TOKEN")
    merchant_id = os.getenv("CLOVER_MERCHANT_ID")

    if not token or not merchant_id:
        print("ERROR: Missing CLOVER_API_TOKEN and/or CLOVER_MERCHANT_ID in environment.", file=sys.stderr)
        sys.exit(2)

    if args.last_week:
        start_d, end_d = parse_last_week_range(dt.date.today())
    else:
        if not args.start_date or not args.end_date:
            print("ERROR: provide --last-week OR both --start-date and --end-date", file=sys.stderr)
            sys.exit(2)
        start_d = parse_date(args.start_date)
        end_d = parse_date(args.end_date)

    start_ms = to_utc_ms(start_d, end_of_day=False)
    end_ms = to_utc_ms(end_d, end_of_day=True)

    try:
        orders, raw = fetch_orders(base_url, merchant_id, token, start_ms, end_ms)
    except Exception as e:
        print("ERROR: Clover API request failed.", file=sys.stderr)
        print(str(e), file=sys.stderr)
        sys.exit(1)

    summary = aggregate_item_sales(orders, args.item, contains_match=not args.exact)
    summary.update(
        {
            "time_range": {"start_date": str(start_d), "end_date": str(end_d), "start_ms": start_ms, "end_ms": end_ms},
            "orders_scanned": len(orders),
            "generated_at_utc_ms": now_utc_ms(),
            "notes": [
                "Read-only query.",
                "Amounts are in Clover minor currency units (usually cents).",
                "If 0 results unexpectedly, verify item naming and Clover line-item fields in your account.",
            ],
        }
    )

    prefix = f"clover_{args.item.lower().replace(' ', '_')}_{start_d}_{end_d}"
    json_path, csv_path = write_outputs(Path(args.output_dir), prefix, summary)

    print(json.dumps({
        "ok": True,
        "item": args.item,
        "time_range": summary["time_range"],
        "orders_scanned": summary["orders_scanned"],
        "quantity_sold": summary["quantity_sold"],
        "gross_minor_units": summary["gross_minor_units"],
        "matched_line_items": summary["matched_line_items"],
        "json_output": json_path,
        "csv_output": csv_path,
    }, indent=2))


if __name__ == "__main__":
    main()
