"""Liquor inventory catalog — shots + pour bottles only (no finished cocktails)."""
from __future__ import annotations

from clover_client import ROOT

DEFAULT_INVENTORY_EXTRA: tuple[str, ...] = ()


def _parse_inventory_extra() -> tuple[str, ...]:
    config_path = ROOT / "config.yaml"
    if not config_path.exists():
        return DEFAULT_INVENTORY_EXTRA
    items: list[str] = []
    in_section = False
    for line in config_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped == "liquor_inventory_extra:":
            in_section = True
            continue
        if in_section:
            if not stripped or stripped.startswith("#"):
                continue
            if not line.startswith(" ") and not line.startswith("\t"):
                break
            if stripped.startswith("- "):
                items.append(stripped[2:].strip().strip('"').strip("'"))
    return tuple(items) if items else DEFAULT_INVENTORY_EXTRA


def filter_liquor_for_inventory(items: list[dict]) -> list[dict]:
    """
    Inventory tab: Shots category + optional liquor_inventory_extra pour bottles.
    Extra names not in Clover are added as synthetic rows (Pour).
    Usage / Supabase sync uses full catalog (minus liquor_catalog_exclude).
    """
    extra_names = _parse_inventory_extra()
    extra_lower = {n.lower() for n in extra_names}
    out: list[dict] = []
    seen: set[str] = set()
    for item in items:
        cat = (item.get("category_name") or "").strip().lower()
        name_lower = item["name"].lower()
        if cat == "shots":
            out.append(item)
            seen.add(name_lower)
        elif name_lower in extra_lower:
            out.append(item)
            seen.add(name_lower)
    for name in extra_names:
        key = name.lower()
        if key in seen:
            continue
        slug = key.replace(" ", "-").replace("/", "-")
        out.append(
            {
                "id": f"inventory-extra:{slug}",
                "name": name,
                "category_name": "Pour",
            }
        )
        seen.add(key)
    out.sort(key=lambda r: r["name"].lower())
    return out
