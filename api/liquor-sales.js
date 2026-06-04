import { fetchLiquorSalesReport } from "./lib/clover-liquor-sales.js";
import { parseLastWeekRange } from "./lib/clover.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ detail: "Method not allowed" });
  }

  try {
    const q = req.query || {};
    let startDate = q.start_date;
    let endDate = q.end_date;
    const preset = q.preset;
    const refresh = q.refresh === "true" || q.refresh === true;

    if (preset === "last_week") {
      const r = parseLastWeekRange();
      startDate = r.start;
      endDate = r.end;
    } else if (preset === "last_7_days") {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      const iso = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${dd}`;
      };
      startDate = iso(start);
      endDate = iso(end);
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        detail: "Provide start_date and end_date, or preset=last_week|last_7_days",
      });
    }

    const report = await fetchLiquorSalesReport(String(startDate), String(endDate), {
      forceRefresh: refresh,
    });
    return res.status(200).json(report);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Missing CLOVER") ? 500 : msg.includes("Clover API") ? 502 : 400;
    return res.status(status).json({ detail: msg });
  }
}
