import { BEER_LINE_ITEMS, canonicalBeerName, emptyBeerRows } from "./beer-line-items.js";

const memoryCache = new Map();
const CACHE_TTL_MS = (Number(process.env.CLOVER_CACHE_TTL_HOURS) || 24) * 3600 * 1000;
const PAGE_DELAY_MS = Number(process.env.CLOVER_REQUEST_DELAY_MS) || 300;

export function getConfig() {
  const token = (process.env.CLOVER_API_TOKEN || "").trim();
  const merchantId = (process.env.CLOVER_MERCHANT_ID || "").trim();
  const baseUrl = (process.env.CLOVER_BASE_URL || "https://api.clover.com").replace(/\/$/, "");
  if (!token || !merchantId) {
    throw new Error(
      "Missing CLOVER_API_TOKEN or CLOVER_MERCHANT_ID. Add them in Vercel → Project → Settings → Environment Variables (your local .env is not uploaded to GitHub).",
    );
  }
  return { token, merchantId, baseUrl };
}

function toUtcMs(dateStr, endOfDay = false) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = endOfDay
    ? new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
    : new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  return dt.getTime();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function cloverGet(cfg, path, query = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (Array.isArray(v)) v.forEach((item) => params.append(k, item));
    else if (v != null) params.append(k, String(v));
  }
  const qs = params.toString();
  const url = `${cfg.baseUrl}/v3/merchants/${cfg.merchantId}/${path.replace(/^\//, "")}${qs ? `?${qs}` : ""}`;

  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: "application/json",
      },
    });
    if (res.status === 429 && attempt < 3) {
      await sleep(2 ** (attempt + 1) * 1000);
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Clover API ${res.status}: ${body.slice(0, 300)}`);
    }
    return res.json();
  }
  throw lastErr || new Error("Clover API request failed");
}

async function fetchAllOrders(cfg, startMs, endMs) {
  const pageSize = 100;
  const maxPages = 50;
  const all = [];
  for (let page = 0, offset = 0; page < maxPages; page++, offset += pageSize) {
    if (page > 0) await sleep(PAGE_DELAY_MS);
    const data = await cloverGet(cfg, "orders", {
      limit: pageSize,
      offset,
      expand: "lineItems",
      filter: [`createdTime>=${startMs}`, `createdTime<=${endMs}`],
    });
    const rows = data.elements || [];
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

function aggregateOrders(orders) {
  const byName = emptyBeerRows();
  for (const order of orders) {
    const lines = order.lineItems?.elements || [];
    for (const line of lines) {
      const canonical = canonicalBeerName(line.name);
      if (!canonical) continue;
      const qty = Number(line.unitQty ?? line.quantity ?? 1) || 1;
      let lineTotal = line.price ?? line.total ?? line.priceWithTax ?? 0;
      lineTotal = Number.parseInt(String(lineTotal), 10) || 0;
      const row = byName[canonical.toLowerCase()];
      row.quantity_sold += qty;
      row.gross_minor_units += lineTotal;
      row.line_count += 1;
    }
  }
  const items = Object.values(byName).sort(
    (a, b) =>
      b.quantity_sold - a.quantity_sold || b.gross_minor_units - a.gross_minor_units,
  );
  return {
    items,
    clover_category: "Beer",
    beer_sku_count: BEER_LINE_ITEMS.length,
    beer_line_items: [...BEER_LINE_ITEMS],
    totals: {
      quantity_sold: items.reduce((s, i) => s + i.quantity_sold, 0),
      gross_minor_units: items.reduce((s, i) => s + i.gross_minor_units, 0),
      unique_items: items.length,
    },
  };
}

function cacheKey(cfg, startDate, endDate) {
  return `sales_v5:${cfg.merchantId}:${startDate}:${endDate}`;
}

export async function fetchSalesReport(startDate, endDate, { forceRefresh = false } = {}) {
  if (endDate < startDate) throw new Error("end_date must be on or after start_date");
  const cfg = getConfig();
  const key = cacheKey(cfg, startDate, endDate);

  if (!forceRefresh) {
    const hit = memoryCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return { ...hit.data, from_cache: true };
    }
  }

  const startMs = toUtcMs(startDate, false);
  const endMs = toUtcMs(endDate, true);
  const orders = await fetchAllOrders(cfg, startMs, endMs);
  const summary = aggregateOrders(orders);

  const report = {
    merchant_id: cfg.merchantId,
    time_range: { start_date: startDate, end_date: endDate, start_ms: startMs, end_ms: endMs },
    generated_at_utc_ms: Date.now(),
    from_cache: false,
    ...summary,
  };

  memoryCache.set(key, { at: Date.now(), data: { ...report, from_cache: false } });
  return report;
}

export function parseLastWeekRange(today = new Date()) {
  const day = today.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - diffToMonday);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);
  const iso = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };
  return { start: iso(lastMonday), end: iso(lastSunday) };
}
