"""Items excluded from liquor usage and inventory (still in Clover; not tracked here)."""
from __future__ import annotations

from clover_client import ROOT

DEFAULT_LIQUOR_CATALOG_EXCLUDE: tuple[str, ...] = (
    "Patron Cocktail Use",
    "Fireball Shot/ Cocktail Use",
)


def _parse_catalog_exclude() -> frozenset[str]:
    config_path = ROOT / "config.yaml"
    names: list[str] = list(DEFAULT_LIQUOR_CATALOG_EXCLUDE)
    if not config_path.exists():
        return frozenset(n.lower() for n in names)
    in_section = False
    for line in config_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped == "liquor_catalog_exclude:":
            in_section = True
            names = []
            continue
        if in_section:
            if not stripped or stripped.startswith("#"):
                continue
            if not line.startswith(" ") and not line.startswith("\t"):
                break
            if stripped.startswith("- "):
                names.append(stripped[2:].strip().strip('"').strip("'"))
    return frozenset(n.lower() for n in names if n)


def filter_liquor_catalog_excluded(items: list[dict]) -> list[dict]:
    exclude = _parse_catalog_exclude()
    if not exclude:
        return items
    return [i for i in items if i["name"].lower() not in exclude]
