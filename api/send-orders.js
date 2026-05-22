import { canonicalBeerName } from "./lib/beer-line-items.js";
import { sendOrderEmails } from "./lib/gmail.js";
import {
  buildDistributorOrders,
  buildEmailPreviews,
} from "./lib/order-build.js";

export const config = {
  maxDuration: 60,
};

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

    const normalized = [];
    for (const line of lines) {
      const name = (line.name || "").trim();
      const canonical = canonicalBeerName(name);
      if (!canonical) {
        return res.status(400).json({ detail: `Unknown item: ${name}` });
      }
      const orderQty = Math.max(0, Math.round(Number(line.orderQty) || 0));
      if (orderQty <= 0) continue;
      normalized.push({
        name: canonical,
        onHand: Number(line.onHand),
        par: Number(line.par),
        orderQty,
      });
    }

    if (normalized.length === 0) {
      return res.status(400).json({ detail: "No items need ordering (all at par)." });
    }

    const { distributors, skipped } = buildDistributorOrders(normalized);
    if (distributors.length === 0) {
      return res.status(400).json({
        detail: "No distributor mapping for items that need ordering.",
        skipped,
      });
    }

    const emails = buildEmailPreviews(distributors);

    const from = (
      process.env.GMAIL_SENDER ||
      process.env.GOOGLE_GMAIL_USER ||
      ""
    ).trim();

    if (!confirm) {
      return res.status(200).json({
        ok: true,
        mode: "review",
        from,
        distributors,
        emails,
        skipped,
      });
    }

    const sent = await sendOrderEmails(emails);
    return res.status(200).json({
      ok: true,
      mode: "sent",
      from,
      message: `Sent ${sent.length} order email${sent.length === 1 ? "" : "s"} from ${from}.`,
      sent,
      emails,
      skipped,
    });
  } catch (e) {
    return res.status(500).json({
      detail: e instanceof Error ? e.message : "Failed to process orders",
    });
  }
}
