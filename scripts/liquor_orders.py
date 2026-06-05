"""Prepare liquor orders for Provi / OHLQ (catalog SKUs + rep notes)."""
from __future__ import annotations

from typing import Any

from liquor_provi_map import lookup_provi_product


def _format_rep_notes(lines: list[dict[str, Any]]) -> str:
    parts = [f"{line['name']}: {line['units_needed']}" for line in lines]
    return "; ".join(parts)


def prepare_liquor_orders(
    lines: list[dict[str, Any]], *, confirm: bool = False, submit: bool = False
) -> dict[str, Any]:
    """
    Build Provi-ready order payload:
    - catalog: product ID + unit qty (one size per SKU)
    - rep_notes: low-ABV / mixers — qty only, paste in checkout rep notes
    """
    catalog_lines: list[dict[str, Any]] = []
    rep_notes_lines: list[dict[str, Any]] = []
    unmapped: list[str] = []

    for line in lines:
        name = (line.get("name") or "").strip()
        if not name:
            continue
        order_qty = max(0, int(round(float(line.get("orderQty") or 0))))
        if order_qty <= 0:
            continue

        mapping = lookup_provi_product(name)
        if not mapping:
            unmapped.append(name)
            continue

        order_via = mapping.get("order_via") or "catalog"
        base = {
            "name": name,
            "units_needed": order_qty,
            "on_hand": line.get("onHand"),
            "par": line.get("par"),
            "wat_on_hand": line.get("watOnHand"),
            "lu_on_hand": line.get("luOnHand"),
            "wat_par": line.get("watPar"),
            "lu_par": line.get("luPar"),
        }

        if order_via == "rep_notes":
            rep_notes_lines.append(base)
        else:
            product_id = mapping.get("provi_product_id")
            if not product_id:
                unmapped.append(name)
                continue
            catalog_lines.append({**base, "provi_product_id": product_id})

    if not catalog_lines and not rep_notes_lines:
        raise ValueError("No liquor items need ordering (all at or above par).")

    if unmapped:
        raise ValueError(
            "Missing Provi mapping for: "
            + ", ".join(sorted(unmapped))
            + ". Run supabase/migrations/006_liquor_provi_product.sql or seed_liquor_provi_map.py."
        )

    rep_notes_text = _format_rep_notes(rep_notes_lines)

    payload = {
        "ok": True,
        "mode": "review" if not confirm else "ready",
        "channel": "provi",
        "catalog_lines": catalog_lines,
        "rep_notes_lines": rep_notes_lines,
        "rep_notes_text": rep_notes_text,
        "instructions": (
            "Add catalog items in Provi by product ID and quantity. "
            "Paste rep_notes_text into Add sales notes for reps at checkout."
        ),
    }

    if confirm:
        payload["message"] = (
            "Order ready for Provi — add catalog lines by ID, then paste rep notes at checkout."
        )
        try:
            from provi.build_order import build_provi_cart

            built = build_provi_cart(catalog_lines, rep_notes_text, submit=submit)
            payload["provi"] = built
            payload["mode"] = built.get("mode") or ("cart_built" if built.get("ok") else "partial")
            payload["message"] = built.get("message") or payload["message"]
            if built.get("errors"):
                payload["provi_errors"] = built["errors"]
        except Exception as e:
            payload["provi_error"] = str(e)
            payload["message"] = (
                f"Provi cart not updated: {e}. Use copy buttons and build manually in Provi."
            )

    return payload
