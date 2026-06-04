import { ProviApiError, ProviClient } from "./provi-client.js";

export async function buildProviCart(catalogLines, repNotesText = "", { submit = false } = {}) {
  if (submit) {
    throw new ProviApiError("Provi submit is not enabled yet. Cart is built as draft only.");
  }

  const client = new ProviClient();
  const location = await client.assertExpectedLocation();
  const added = [];
  const errors = [];

  for (const line of catalogLines) {
    const sku = String(line.provi_product_id || "").trim();
    const qty = Math.max(0, Math.round(Number(line.units_needed) || 0));
    const name = line.name || sku;
    if (!sku || qty <= 0) continue;
    try {
      const inv = await client.resolveInventoryBySku(sku);
      const result = await client.addUnitsToCart(inv.inventory_id, qty);
      added.push({
        name,
        provi_product_id: sku,
        inventory_id: inv.inventory_id,
        units_needed: qty,
        resolved_sku: inv.sku,
        container_size: inv.container_size,
        cart_response_sku: result?.sku,
      });
    } catch (e) {
      errors.push(`${name} (${sku}): ${e instanceof Error ? e.message : e}`);
    }
  }

  let orderId = null;
  if (String(repNotesText || "").trim()) {
    try {
      const cart = await client.getCart();
      orderId = client.findOhlqOrderId(cart);
      if (!orderId) throw new ProviApiError("No OHLQ order in cart to attach rep notes");
      await client.setRetailerNotes(orderId, repNotesText.trim());
    } catch (e) {
      errors.push(`Rep notes: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (errors.length && !added.length) {
    throw new ProviApiError(errors.join("; "));
  }

  const cart = await client.getCart();
  return {
    ok: errors.length === 0,
    mode: "cart_built",
    submit: false,
    location,
    cart_id: cart.id,
    cart_total: cart.total,
    order_id: orderId,
    added,
    rep_notes: repNotesText,
    errors,
    message:
      errors.length === 0
        ? "Provi cart updated — review in app and click Send when ready."
        : "Cart partially built; see errors.",
    provi_cart_url: "https://app.provi.com/cart",
  };
}
