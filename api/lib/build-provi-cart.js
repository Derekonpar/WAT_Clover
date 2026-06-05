import { ProviApiError, ProviClient, proviSubmitAllowed } from "./provi-client.js";

export async function buildProviCart(catalogLines, repNotesText = "", { submit = false } = {}) {
  if (submit && !proviSubmitAllowed()) {
    throw new ProviApiError(
      "Provi submit is disabled. Set PROVI_ALLOW_SUBMIT=true to send orders from the dashboard.",
    );
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
  let cartTotal = cart.total;
  let submittedAt = null;

  if (submit) {
    if (errors.length) {
      throw new ProviApiError(`Cannot submit cart with errors: ${errors.join("; ")}`);
    }
    if (!added.length && !String(repNotesText || "").trim()) {
      throw new ProviApiError("Nothing to submit — cart is empty.");
    }
    const submitted = await client.submitCart();
    submittedAt = submitted.submitted_at ?? null;
    cartTotal = submitted.total ?? cartTotal;
  }

  const mode = submit ? "submitted" : "cart_built";
  const message = submit
    ? errors.length === 0
      ? "Order sent to Provi — your rep will receive the request."
      : "Order partially sent; see errors."
    : errors.length === 0
      ? "Provi cart updated — review in app and click Send when ready."
      : "Cart partially built; see errors.";

  return {
    ok: errors.length === 0,
    mode,
    submit,
    location,
    cart_id: cart.id,
    cart_total: cartTotal,
    order_id: orderId,
    submitted_at: submittedAt,
    added,
    rep_notes: repNotesText,
    errors,
    message,
    provi_cart_url: "https://app.provi.com/cart",
  };
}
