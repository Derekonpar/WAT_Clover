import { getConfig } from "./lib/clover.js";

export default function handler(req, res) {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const cfg = getConfig();
    return res.status(200).json({ ok: true, merchant_id: cfg.merchantId });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "Configuration error",
    });
  }
}
