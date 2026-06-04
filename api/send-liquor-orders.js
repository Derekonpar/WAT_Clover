import { buildProviCart } from "./lib/build-provi-cart.js";
import { buildProviLiquorOrder } from "./lib/liquor-provi-map.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ detail: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const lines = body?.lines;
    const confirm = Boolean(body?.confirm);

    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ detail: "Expected { lines: [...] }" });
    }

    const order = buildProviLiquorOrder(lines);

    const payload = {
      ok: true,
      mode: confirm ? "ready" : "review",
      channel: "provi",
      ...order,
      instructions:
        "Add catalog items in Provi by product ID and quantity. Paste rep_notes_text into Add sales notes for reps at checkout.",
    };

    if (confirm) {
      try {
        const built = await buildProviCart(order.catalog_lines, order.rep_notes_text, {
          submit: false,
        });
        payload.provi = built;
        payload.mode = built.ok ? "cart_built" : "partial";
        payload.message =
          built.message ||
          "Provi cart updated — open Provi to review and Send when ready.";
        if (built.errors?.length) payload.provi_errors = built.errors;
      } catch (e) {
        payload.provi_error = e instanceof Error ? e.message : String(e);
        payload.message = `Provi cart not updated: ${payload.provi_error}. Use copy buttons and build manually in Provi.`;
      }
    }

    return res.status(200).json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to process liquor orders";
    const status = msg.includes("No liquor items") || msg.includes("Missing Provi") ? 400 : 500;
    return res.status(status).json({ detail: msg });
  }
}
