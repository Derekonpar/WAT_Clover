import { updateBeerParForOrders } from "../lib/beer-par.js";

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ detail: "Method not allowed" });
  }

  try {
    const refresh = req.query?.refresh !== "false" && req.query?.refresh !== "0";
    const data = await updateBeerParForOrders({ forceRefresh: refresh });
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({
      detail: e instanceof Error ? e.message : "Failed to update beer par",
    });
  }
}
