import { BEER_LINE_ITEMS, canonicalBeerName } from "./beer-line-items.js";
import { fetchLiquorCatalog } from "./clover-catalog.js";
import { resolveLiquorLineWithDedupe } from "./liquor-shot-dedupe.js";
import { getConfig } from "./clover.js";

const memoryCache = new Map();
const CACHE_TTL_MS = (Number(process.env.CLOVER_CACHE_TTL_HOURS) || 24) * 3600 * 1000;
const PAGE_DELAY_MS = Number(process.env.CLOVER_REQUEST_DELAY_MS) || 300;

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
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Clover API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
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

function toUtcMs(dateStr, endOfDay = false) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = endOfDay
    ? new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
    : new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  return dt.getTime();
}

async function buildUsageRegistry() {
  const catalog = await fetchLiquorCatalog({ forceRefresh: false });
  const byName = new Map();

  for (const name of BEER_LINE_ITEMS) {
    byName.set(name.toLowerCase(), { name, category_name: "Beer" });
  }

  for (const item of catalog.items) {
    if (canonicalBeerName(item.name)) continue;
    byName.set(item.name.toLowerCase(), {
      name: item.name,
      category_name: item.category_name || "Liquor",
      id: item.id,
    });
  }

  const items = [...byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  let categories = [...new Set(items.map((i) => i.category_name))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  if (categories.includes("Beer")) {
    categories = ["Beer", ...categories.filter((c) => c !== "Beer")];
  }

  const byId = {};
  for (const item of items) {
    if (item.id) byId[item.id] = item;
  }
  const idRemapIds = catalog.dedupe_id_remap || {};
  const idRemap = {};
  for (const [fromId, toId] of Object.entries(idRemapIds)) {
    if (byId[toId]) idRemap[fromId] = byId[toId];
  }
  const byNameObj = Object.fromEntries(byName);

  return {
    items,
    byName: byNameObj,
    byId,
    categories,
    sku_count: items.length,
    nameRemap: catalog.liquor_to_shot_remap || {},
    idRemap,
  };
}

function emptyUsageRows(registry) {
  const rows = {};
  for (const item of registry.items) {
    rows[item.name.toLowerCase()] = {
      name: item.name,
      category_name: item.category_name,
      quantity_sold: 0,
      gross_minor_units: 0,
      line_count: 0,
    };
  }
  return rows;
}

function resolveUsageLine(registry, line) {
  const rawName = (line.name || "").trim();
  const beer = canonicalBeerName(rawName);
  if (beer) return registry.byName[beer.toLowerCase()];

  return resolveLiquorLineWithDedupe(
    {
      byId: registry.byId,
      byName: registry.byName,
      nameRemap: registry.nameRemap,
      idRemap: registry.idRemap,
    },
    line,
  );
}

function aggregateUsageOrders(orders, registry) {
  const byName = emptyUsageRows(registry);

  for (const order of orders) {
    const lines = order.lineItems?.elements || [];
    for (const line of lines) {
      const item = resolveUsageLine(registry, line);
      if (!item) continue;
      const qty = Number(line.unitQty ?? line.quantity ?? 1) || 1;
      let lineTotal = line.price ?? line.total ?? line.priceWithTax ?? 0;
      lineTotal = Number.parseInt(String(lineTotal), 10) || 0;
      const row = byName[item.name.toLowerCase()];
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
    categories: registry.categories,
    sku_count: registry.sku_count,
    totals: {
      quantity_sold: items.reduce((s, i) => s + i.quantity_sold, 0),
      gross_minor_units: items.reduce((s, i) => s + i.gross_minor_units, 0),
      unique_items: items.filter((i) => i.quantity_sold > 0).length,
    },
  };
}

function cacheKey(cfg, startDate, endDate) {
  return `usage_v1:${cfg.merchantId}:${startDate}:${endDate}`;
}

export async function fetchUsageReport(startDate, endDate, { forceRefresh = false } = {}) {
  if (endDate < startDate) throw new Error("end_date must be on or after start_date");
  const cfg = getConfig();
  const key = cacheKey(cfg, startDate, endDate);

  if (!forceRefresh) {
    const hit = memoryCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return { ...hit.data, from_cache: true };
    }
  }

  const registry = await buildUsageRegistry();
  const startMs = toUtcMs(startDate, false);
  const endMs = toUtcMs(endDate, true);
  const orders = await fetchAllOrders(cfg, startMs, endMs);
  const summary = aggregateUsageOrders(orders, registry);

  const report = {
    merchant_id: cfg.merchantId,
    time_range: { start_date: startDate, end_date: endDate, start_ms: startMs, end_ms: endMs },
    generated_at_utc_ms: Date.now(),
    from_cache: false,
    ...summary,
  };
  memoryCache.set(key, { at: Date.now(), data: report });
  return report;
}
