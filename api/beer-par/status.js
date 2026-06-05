import { lastCompleteSunSatWeek } from "../lib/week-calendar.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ detail: "Method not allowed" });
  }

  try {
    const { start, end } = lastCompleteSunSatWeek();
    return res.status(200).json({
      ok: true,
      order_week: { start, end },
    });
  } catch (e) {
    return res.status(500).json({
      detail: e instanceof Error ? e.message : "Failed to load beer par status",
    });
  }
}
