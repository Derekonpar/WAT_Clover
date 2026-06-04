"""Drop Liquor SKUs that duplicate a Shots-category item; remap sales to the shot."""
from __future__ import annotations

from typing import Any

from clover_client import ROOT

# Defaults — also editable in config.yaml `liquor_drop_for_shots`
DEFAULT_LIQUOR_DROP_FOR_SHOTS: dict[str, str] = {
    "Patron SHOT ONLY": "Patron Shot",
    "Crown Apple Whiskey": "Crown Royal Apple Shot",
    "Jack Daniel's Whiskey": "Jack Daniel Shot",
    "Captain Morgan Rum": "Captain Morgan Shot",
    "Woodford Reserve": "Woodford Reserve Shot",
    "Titos Vodka": "Tito Shot",
}


def _parse_liquor_drop_for_shots() -> dict[str, str]:
    """Parse liquor_drop_for_shots: Liquor Name: Shots Name from config.yaml."""
    config_path = ROOT / "config.yaml"
    out = dict(DEFAULT_LIQUOR_DROP_FOR_SHOTS)
    if not config_path.exists():
        return out
    in_section = False
    for line in config_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped == "liquor_drop_for_shots:":
            in_section = True
            continue
        if in_section:
            if not stripped or stripped.startswith("#"):
                continue
            if not line.startswith(" ") and not line.startswith("\t"):
                break
            if ":" not in stripped:
                continue
            key, _, val = stripped.partition(":")
            key = key.strip().strip('"').strip("'")
            val = val.strip().strip('"').strip("'")
            if key and val:
                out[key] = val
    return out


def _auto_shot_only_pairs(items: list[dict[str, Any]], drop_map: dict[str, str]) -> dict[str, str]:
    """Map Liquor '… SHOT ONLY' rows to a Shots SKU when not already configured."""
    shots = [
        i["name"]
        for i in items
        if (i.get("category_name") or "").strip().lower() == "shots"
    ]
    if not shots:
        return {}
    extras: dict[str, str] = {}
    configured = {k.lower() for k in drop_map}
    for item in items:
        if (item.get("category_name") or "").strip().lower() != "liquor":
            continue
        name = item["name"]
        if name.lower() in configured:
            continue
        if "shot only" not in name.lower():
            continue
        token = name.split()[0].lower()
        for shot in shots:
            if shot.lower().startswith(token):
                extras[name] = shot
                break
    return extras


def apply_liquor_shot_dedupe(
    items: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, str], dict[str, dict[str, Any]]]:
    """
    Remove Liquor duplicates when the Shots SKU exists.

    Returns:
      filtered_items, name_remap (liquor_lower -> shot_name),
      id_remap (dropped_clover_id -> shot_item)
    """
    drop_map = _parse_liquor_drop_for_shots()
    drop_map.update(_auto_shot_only_pairs(items, drop_map))

    by_name = {i["name"]: i for i in items}
    shot_names = {
        i["name"].lower()
        for i in items
        if (i.get("category_name") or "").strip().lower() == "shots"
    }

    exclude: set[str] = set()
    name_remap: dict[str, str] = {}
    for liquor_name, shot_name in drop_map.items():
        if shot_name.lower() not in shot_names:
            continue
        if liquor_name.lower() not in {i["name"].lower() for i in items}:
            continue
        exclude.add(liquor_name.lower())
        name_remap[liquor_name.lower()] = shot_name

    id_remap: dict[str, dict[str, Any]] = {}
    filtered: list[dict[str, Any]] = []
    for item in items:
        if item["name"].lower() in exclude:
            shot_name = name_remap[item["name"].lower()]
            shot_item = by_name.get(shot_name)
            if shot_item and item.get("id"):
                id_remap[item["id"]] = shot_item
            continue
        filtered.append(item)

    return filtered, name_remap, id_remap


def resolve_liquor_line_with_dedupe(
    registry: dict[str, Any],
    line: dict[str, Any],
) -> dict[str, Any] | None:
    """Resolve order line to catalog item, remapping dropped Liquor SKUs to Shots."""
    raw_name = (line.get("name") or "").strip()
    name_remap: dict[str, str] = registry.get("liquor_to_shot_remap") or {}
    id_remap: dict[str, dict[str, Any]] = registry.get("dedupe_id_remap") or {}

    item_ref = line.get("item")
    item_id = item_ref.get("id") if isinstance(item_ref, dict) else None
    if item_id and item_id in id_remap:
        return id_remap[item_id]

    if raw_name and raw_name.lower() in name_remap:
        shot = name_remap[raw_name.lower()]
        return registry["by_name"].get(shot.lower())

    if item_id and item_id in registry.get("by_id", {}):
        return registry["by_id"][item_id]
    if raw_name and raw_name.lower() in registry.get("by_name", {}):
        return registry["by_name"][raw_name.lower()]
    return None
