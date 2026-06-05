"""Build Provi cart from liquor dashboard order payload (optional submit)."""
from __future__ import annotations

from typing import Any

from provi.client import ProviApiError, ProviClient
from provi.paths import PROVI_ALLOW_SUBMIT


def build_provi_cart(
    catalog_lines: list[dict[str, Any]],
    rep_notes_text: str = "",
    *,
    submit: bool = False,
) -> dict[str, Any]:
    """
    1. Resolve each provi_product_id → inventory_id (exact SKU match among variants)
    2. POST update_cart for each line
    3. PUT retailer_notes on OHLQ order
    4. POST /api/retailer/cart/submit when submit=True
    """
    if submit and not PROVI_ALLOW_SUBMIT:
        raise ProviApiError(
            "Provi submit is disabled. Set PROVI_ALLOW_SUBMIT=true to send orders from the dashboard."
        )

    client = ProviClient()
    location = client.assert_expected_location()
    added: list[dict[str, Any]] = []
    errors: list[str] = []

    for line in catalog_lines:
        sku = (line.get("provi_product_id") or "").strip()
        qty = int(line.get("units_needed") or 0)
        name = line.get("name") or sku
        if not sku or qty <= 0:
            continue
        try:
            inv = client.resolve_inventory_by_sku(sku)
            result = client.add_units_to_cart(inv["inventory_id"], qty)
            added.append(
                {
                    "name": name,
                    "provi_product_id": sku,
                    "inventory_id": inv["inventory_id"],
                    "units_needed": qty,
                    "resolved_sku": inv["sku"],
                    "container_size": inv.get("container_size"),
                    "cart_response_sku": result.get("sku"),
                }
            )
        except ProviApiError as e:
            errors.append(f"{name} ({sku}): {e}")

    notes_result = None
    order_id = None
    if rep_notes_text.strip():
        try:
            cart = client.get_cart()
            order_id = client.find_ohlq_order_id(cart)
            if not order_id:
                raise ProviApiError("No OHLQ order in cart to attach rep notes")
            notes_result = client.set_retailer_notes(order_id, rep_notes_text.strip())
        except ProviApiError as e:
            errors.append(f"Rep notes: {e}")

    if errors and not added:
        raise ProviApiError("; ".join(errors))

    cart = client.get_cart()
    cart_total = cart.get("total")
    submitted_at = None

    if submit:
        if errors:
            raise ProviApiError("Cannot submit cart with errors: " + "; ".join(errors))
        if not added and not rep_notes_text.strip():
            raise ProviApiError("Nothing to submit — cart is empty.")
        submitted = client.submit_cart()
        submitted_at = submitted.get("submitted_at")
        cart_total = submitted.get("total", cart_total)

    mode = "submitted" if submit else "cart_built"
    if submit:
        message = (
            "Order sent to Provi — your rep will receive the request."
            if not errors
            else "Order partially sent; see errors."
        )
    else:
        message = (
            "Provi cart updated — review in app and click Send when ready."
            if not errors
            else "Cart partially built; see errors."
        )

    payload = {
        "ok": len(errors) == 0,
        "mode": mode,
        "submit": submit,
        "location": location,
        "cart_id": cart.get("id"),
        "cart_total": cart_total,
        "order_id": order_id,
        "submitted_at": submitted_at,
        "added": added,
        "rep_notes": rep_notes_text,
        "errors": errors,
        "message": message,
        "provi_cart_url": "https://app.provi.com/cart",
    }
    return payload
