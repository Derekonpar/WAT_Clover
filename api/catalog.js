import { fetchLiquorInventoryCatalog } from "./lib/clover-catalog.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ detail: "Method not allowed" });
  }

  try {
    const refresh =
      req.query?.refresh === "true" || req.query?.refresh === "1";
    const catalog = await fetchLiquorInventoryCatalog({ forceRefresh: refresh });
    return res.status(200).json({ ok: true, ...catalog });
  } catch (e) {
    return res.status(500).json({
      detail: e instanceof Error ? e.message : "Failed to load catalog",
    });
  }
}
