import { suggestedParFromSupabase } from "./lib/beer-par.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ detail: "Method not allowed" });
  }

  try {
    const weeks = Math.min(26, Math.max(1, Number(req.query?.weeks) || 6));
    const refresh = req.query?.refresh === "true" || req.query?.refresh === "1";
    const data = await suggestedParFromSupabase(weeks, { forceRefresh: refresh });
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({
      detail: e instanceof Error ? e.message : "Failed to load suggested par",
    });
  }
}
