#!/usr/bin/env python3
"""
Cocktail recipe → liquor inventory usage (Supabase usage_weekly only).

Does not touch the dashboard. Writes docs/analysis/liquor-usage-par-estimate.md

  python3 scripts/analyze_liquor_usage.py
  python3 scripts/analyze_liquor_usage.py --weeks 6
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from clover_client import allowed_beer_line_items, canonical_beer_name, load_dotenv  # noqa: E402
from supabase_client import get_supabase  # noqa: E402

# Liquor inventory tab items (shots + pour bottles)
INVENTORY_ITEMS = [
    "Tito Shot",
    "Patron Shot",
    "Crown Royal Apple Shot",
    "Captain Morgan Shot",
    "Jack Daniel Shot",
    "Woodford Reserve Shot",
    "Amaretto",
    "Svedka Blue Raspberry",
    "Knobb Creek Maple",
    "Cruzan Vanilla",
    "Triple Sec",
    "Strawberry Pucker",
    "Orange bitters",
    "Midori",
    "Simple Syrup",
    "Grenadine",
    "Sour mix",
]

# Clover menu name → recipe key (Cocktail Recipes.pdf)
CLOVER_COCKTAIL_ALIASES: dict[str, str] = {
    "cherry wood": "Cherrywood",
    "bigfoot": "Bigfoot",
    "old fashion": "Old Fashion",
    "wizards spellbook": "Wizards Spellbook",
    "the wizard spellbook": "Wizards Spellbook",
    "strawberry marg": "Strawberry Margarita",
    "moscow mule": "Moscow Mule",
    "slice cream float": "Slice Cream Float",
    "the enchanted apple": "Enchanted Apple",
    "enchanted apple": "Enchanted Apple",
    "dirty shirley": "Dirty Shirley",
    "blue dot": "Blue Dot",
    "lemon drop": "Lemon Drop",
    "white tea": "White Tea",
    "apple pie": "Apple Pie",
    "short n' sweet": "Short n Sweet",
    "short n sweet": "Short n Sweet",
    "tropical gentleman": "Tropical Gentleman",
    "jalapeño marg": "Jalapeno Marg",
    "jalapeno marg": "Jalapeno Marg",
    "pinkypromise": "PinkyPromise",
    "prince of darkness": "Prince of Darkness",
    "prince ofdarkness": "Prince of Darkness",
}

# Recipe: inventory item → oz per cocktail (from Cocktail Recipes.pdf)
# Spirits without explicit oz use SPIRIT_DEFAULT_OZ. Patron/Cuervo split 50/50 → Patron Shot.
COCKTAIL_RECIPES: dict[str, list[tuple[str, float]]] = {
    "Cherrywood": [
        ("Amaretto", 1.25),
        ("Sour mix", 1.25),
    ],
    "Bigfoot": [
        ("Knobb Creek Maple", 1.25),
        ("Sour mix", 1.25),
    ],
    "Apple Pie": [
        ("Crown Royal Apple Shot", 1.25),
        ("Sour mix", 1.25),
    ],
    "Moscow Mule": [
        ("Tito Shot", 1.25),
    ],
    "Old Fashion": [
        ("Woodford Reserve Shot", 2.0),
        ("Simple Syrup", 0.25),
        ("Orange bitters", 0.09),  # 3 dashes ≈ 0.09 oz
    ],
    "Short n Sweet": [
        ("Patron Shot", 1.25),
        ("Strawberry Pucker", 0.5),
    ],
    "Enchanted Apple": [
        ("Crown Royal Apple Shot", 1.25),
        ("Sour mix", 1.0),
        ("Midori", 0.5),
        ("Simple Syrup", 0.25),
    ],
    "Tropical Gentleman": [
        ("Woodford Reserve Shot", 2.0),
        ("Simple Syrup", 1.0),
        ("Orange bitters", 0.06),
    ],
    "Slice Cream Float": [
        ("Cruzan Vanilla", 1.25),
    ],
    "Strawberry Margarita": [
        ("Patron Shot", 1.25),
        ("Sour mix", 1.5),
        ("Triple Sec", 1.25),
        ("Strawberry Pucker", 2.0),
    ],
    "Jalapeno Marg": [
        ("Patron Shot", 1.25),
        ("Sour mix", 1.5),
        ("Triple Sec", 1.25),
    ],
    "Dirty Shirley": [
        ("Tito Shot", 1.25),
        ("Grenadine", 0.25),
    ],
    "Blue Dot": [
        ("Svedka Blue Raspberry", 1.25),
    ],
    "Lemon Drop": [
        ("Tito Shot", 0.5),
        ("Triple Sec", 0.5),
        ("Simple Syrup", 0.5),
    ],
    "White Tea": [
        ("Tito Shot", 0.5),
        ("Sour mix", 0.5),
    ],
    "Wizards Spellbook": [
        ("Tito Shot", 1.25),
    ],
    "Prince of Darkness": [
        ("Tito Shot", 1.25),
        ("Midori", 0.75),
    ],
}

# Standalone Clover shot → inventory item + oz per shot sold
STANDALONE_SHOTS: dict[str, tuple[str, float]] = {
    "tito shot": ("Tito Shot", 1.5),
    "patron shot": ("Patron Shot", 1.5),
    "crown royal apple shot": ("Crown Royal Apple Shot", 1.5),
    "captain morgan shot": ("Captain Morgan Shot", 1.5),
    "jack daniel shot": ("Jack Daniel Shot", 1.5),
    "woodford reserve shot": ("Woodford Reserve Shot", 1.5),
}

# Retail bottle sizes (oz). Default 1 L; Patron, Midori, Knob Creek, Svedka = 750 mL.
OZ_PER_L = 33.814
OZ_750ML = 25.360

BOTTLE_OZ: dict[str, float] = {item: OZ_PER_L for item in INVENTORY_ITEMS}
BOTTLE_OZ.update(
    {
        "Patron Shot": OZ_750ML,
        "Midori": OZ_750ML,
        "Knobb Creek Maple": OZ_750ML,
        "Svedka Blue Raspberry": OZ_750ML,
    }
)

BEER_NAMES = {n.lower() for n in allowed_beer_line_items()}


def _is_beer(name: str) -> bool:
    return name.lower() in BEER_NAMES or bool(canonical_beer_name(name))


def fetch_weeks_from_supabase(merchant_id: str, weeks: int) -> list[str]:
    client = get_supabase()
    res = (
        client.table("usage_weekly")
        .select("week_start,week_end")
        .eq("merchant_id", merchant_id)
        .execute()
    )
    pairs = sorted({(r["week_start"], r["week_end"]) for r in res.data or []}, reverse=True)
    # Prefer Mon–Sun weeks (most history); fall back to any
    mon_weeks = [ws for ws, we in pairs if dt.date.fromisoformat(ws).weekday() == 0]
    chosen = mon_weeks[:weeks] if len(mon_weeks) >= weeks else [ws for ws, _ in pairs[:weeks]]
    return sorted(chosen)


def fetch_usage(merchant_id: str, week_starts: list[str]) -> list[dict[str, Any]]:
    client = get_supabase()
    rows: list[dict[str, Any]] = []
    for ws in week_starts:
        res = (
            client.table("usage_weekly")
            .select("item_name,category_name,week_start,quantity_sold")
            .eq("merchant_id", merchant_id)
            .eq("week_start", ws)
            .execute()
        )
        rows.extend(res.data or [])
    return rows


def analyze(weeks: int = 6) -> dict[str, Any]:
    load_dotenv()
    from clover_client import get_config

    cfg = get_config()
    week_starts = fetch_weeks_from_supabase(cfg.merchant_id, weeks)
    if not week_starts:
        raise RuntimeError("No usage_weekly rows in Supabase.")

    raw = fetch_usage(cfg.merchant_id, week_starts)
    n_weeks = len(week_starts)

    cocktail_qty: dict[str, int] = defaultdict(int)
    shot_qty: dict[str, int] = defaultdict(int)

    for row in raw:
        name = (row.get("item_name") or "").strip()
        cat = (row.get("category_name") or "").strip().lower()
        qty = int(row.get("quantity_sold") or 0)
        if qty <= 0 or _is_beer(name):
            continue
        key = name.lower()
        if cat == "shots":
            shot_qty[key] += qty
        elif cat in ("liquor", "cocktail", "wine"):
            recipe_key = CLOVER_COCKTAIL_ALIASES.get(key)
            if recipe_key:
                cocktail_qty[recipe_key] += qty

    oz_from_cocktails: dict[str, float] = defaultdict(float)
    cocktail_breakdown: list[dict[str, Any]] = []

    for recipe, sold in sorted(cocktail_qty.items(), key=lambda x: -x[1]):
        ingredients = COCKTAIL_RECIPES.get(recipe)
        if not ingredients:
            cocktail_breakdown.append(
                {"cocktail": recipe, "sold": sold, "note": "no recipe mapping — skipped"}
            )
            continue
        per_cocktail: list[dict[str, Any]] = []
        for inv_item, oz_each in ingredients:
            total_oz = sold * oz_each
            oz_from_cocktails[inv_item] += total_oz
            per_cocktail.append({"item": inv_item, "oz_each": oz_each, "total_oz": total_oz})
        cocktail_breakdown.append(
            {"cocktail": recipe, "sold": sold, "ingredients": per_cocktail}
        )

    oz_from_shots: dict[str, float] = defaultdict(float)
    shot_breakdown: list[dict[str, Any]] = []

    for clover_key, sold in sorted(shot_qty.items(), key=lambda x: -x[1]):
        mapping = STANDALONE_SHOTS.get(clover_key)
        if not mapping:
            shot_breakdown.append({"clover_shot": clover_key, "sold": sold, "note": "not mapped"})
            continue
        inv_item, oz_per = mapping
        total_oz = sold * oz_per
        oz_from_shots[inv_item] += total_oz
        shot_breakdown.append(
            {
                "clover_shot": clover_key,
                "inventory_item": inv_item,
                "sold": sold,
                "oz_per_shot": oz_per,
                "total_oz": total_oz,
            }
        )

    totals: list[dict[str, Any]] = []
    for item in INVENTORY_ITEMS:
        cock_oz = oz_from_cocktails.get(item, 0.0)
        shot_oz = oz_from_shots.get(item, 0.0)
        total_oz = cock_oz + shot_oz
        shots_only = sum(
            b["sold"] for b in shot_breakdown if b.get("inventory_item") == item
        )
        bottle = BOTTLE_OZ.get(item, 25.4)
        totals.append(
            {
                "item": item,
                "weeks": n_weeks,
                "total_oz": round(total_oz, 2),
                "avg_oz_per_week": round(total_oz / n_weeks, 2),
                "oz_from_cocktails": round(cock_oz, 2),
                "oz_from_standalone_shots": round(shot_oz, 2),
                "standalone_shots_sold": shots_only,
                "avg_shots_per_week": round(shots_only / n_weeks, 2),
                "bottle_oz_assumed": bottle,
                "avg_bottles_per_week": round((total_oz / n_weeks) / bottle, 3),
                "weeks_to_empty_one_bottle": round(bottle / (total_oz / n_weeks), 1)
                if total_oz > 0
                else None,
            }
        )

    totals.sort(key=lambda r: -r["total_oz"])
    return {
        "merchant_id": cfg.merchant_id,
        "weeks_analyzed": n_weeks,
        "week_starts": week_starts,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "cocktail_breakdown": cocktail_breakdown,
        "shot_breakdown": shot_breakdown,
        "totals": totals,
        "notes": [
            "Data source: Supabase usage_weekly only (no live Clover calls).",
            "Cocktail oz from Cocktail Recipes.pdf mapped to liquor inventory tab items.",
            "Spirits listed without oz in PDF assumed 1.25 oz pour; standalone shots 1.5 oz each.",
            "Margarita spirit credited to Patron Shot (Cuervo not in inventory tab).",
            "Bottle sizes: 1 L (33.8 oz) default; Patron, Midori, Knobb Creek Maple, Svedka = 750 mL (25.4 oz).",
        ],
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# Liquor & mixer usage — par estimate (Supabase only)",
        "",
        f"**Merchant:** `{report['merchant_id']}`  ",
        f"**Weeks analyzed:** {report['weeks_analyzed']}  ",
        f"**Week starts:** {', '.join(report['week_starts'])}  ",
        f"**Generated:** {report['generated_at']}",
        "",
        "## Assumptions",
        "",
    ]
    for n in report["notes"]:
        lines.append(f"- {n}")
    lines.extend(["", "## Inventory totals (cocktails + standalone shots)", ""])
    lines.append(
        "| Item | Total oz | Avg oz/wk | Oz cocktails | Oz shots | Shots sold | Avg shots/wk | Bottle (oz) | Avg bottles/wk | Wks/bottle |"
    )
    lines.append(
        "|------|--------:|----------:|-------------:|---------:|-----------:|-------------:|------------:|---------------:|-----------:|"
    )
    for r in report["totals"]:
        if r["total_oz"] <= 0:
            continue
        wks = r["weeks_to_empty_one_bottle"]
        wks_s = f"{wks}" if wks is not None else "—"
        lines.append(
            f"| {r['item']} | {r['total_oz']} | {r['avg_oz_per_week']} | {r['oz_from_cocktails']} | "
            f"{r['oz_from_standalone_shots']} | {r['standalone_shots_sold']} | {r['avg_shots_per_week']} | "
            f"{r['bottle_oz_assumed']} | {r['avg_bottles_per_week']} | {wks_s} |"
        )

    lines.extend(["", "## Cocktails sold (decomposed)", ""])
    lines.append("| Cocktail | Sold | Inventory usage |")
    lines.append("|----------|-----:|-------------------|")
    for c in report["cocktail_breakdown"]:
        if c.get("note"):
            lines.append(f"| {c['cocktail']} | {c['sold']} | _{c['note']}_ |")
            continue
        parts = ", ".join(
            f"{i['item']} {i['oz_each']}oz×{c['sold']}={i['total_oz']:.1f}oz"
            for i in c.get("ingredients", [])
        )
        lines.append(f"| {c['cocktail']} | {c['sold']} | {parts} |")

    lines.extend(["", "## Standalone shots", ""])
    lines.append("| Clover shot | Inventory | Sold | oz/shot | Total oz |")
    lines.append("|-------------|-----------|-----:|--------:|---------:|")
    for s in report["shot_breakdown"]:
        if s.get("note"):
            lines.append(f"| {s['clover_shot']} | — | {s['sold']} | — | _unmapped_ |")
        else:
            lines.append(
                f"| {s['clover_shot']} | {s['inventory_item']} | {s['sold']} | {s['oz_per_shot']} | {s['total_oz']} |"
            )

    lines.extend(["", "## Par hint", ""])
    lines.append(
        "Multiply **avg bottles/wk** by how many weeks of stock you want on hand "
        "(e.g. 2 weeks → par ≈ 2 × avg bottles/wk, round up). "
        "WAT and LU may differ if sales skew by location — this report is combined."
    )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Liquor usage from cocktails (Supabase only)")
    parser.add_argument("--weeks", type=int, default=6)
    args = parser.parse_args()

    report = analyze(weeks=args.weeks)
    out = ROOT / "docs" / "analysis" / "liquor-usage-par-estimate.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_markdown(report), encoding="utf-8")
    print(f"Wrote {out}")
    print()
    print(render_markdown(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
