"""Load docs/liquor-par-build.yaml (no PyYAML dependency)."""
from __future__ import annotations

from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
BUILD_FILE = ROOT / "docs" / "liquor-par-build.yaml"


def load_liquor_par_build_file(path: Path | None = None) -> dict[str, Any]:
    """Return { merchant_id?, items: { name: { wat, lu } } }."""
    path = path or BUILD_FILE
    if not path.exists():
        return {"items": {}}
    merchant_id: str | None = None
    items: dict[str, dict[str, int]] = {}
    in_items = False
    current: str | None = None
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("merchant_id:"):
            merchant_id = stripped.split(":", 1)[1].strip().strip('"').strip("'")
            continue
        if stripped == "items:":
            in_items = True
            continue
        if not in_items:
            continue
        if not stripped or stripped.startswith("#"):
            continue
        if not line.startswith(" ") and stripped:
            break
        if stripped.startswith("wat:"):
            if current:
                try:
                    items[current]["wat"] = int(stripped.split(":", 1)[1].strip())
                except ValueError:
                    pass
            continue
        if stripped.startswith("lu:"):
            if current:
                try:
                    items[current]["lu"] = int(stripped.split(":", 1)[1].strip())
                except ValueError:
                    pass
            continue
        if ":" in stripped and not stripped.startswith("wat:") and not stripped.startswith("lu:"):
            key, _, _ = stripped.partition(":")
            key = key.strip().strip('"').strip("'")
            if key:
                current = key
                items.setdefault(current, {"wat": 0, "lu": 0})
    out: dict[str, Any] = {"items": items}
    if merchant_id:
        out["merchant_id"] = merchant_id
    return out
