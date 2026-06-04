import { liquorParFromSupabase } from "./lib/liquor-par.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ detail: "Method not allowed" });
  }

  try {
    const refresh = req.query?.refresh === "true" || req.query?.refresh === "1";
    const data = await liquorParFromSupabase({ forceRefresh: refresh });
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({
      detail: e instanceof Error ? e.message : "Failed to load liquor par",
    });
  }
}
