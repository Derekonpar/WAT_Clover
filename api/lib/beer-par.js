/** Beer par from Supabase usage_weekly (sync with scripts/usage_sync.py). */
import { BEER_LINE_ITEMS, canonicalBeerName } from "./beer-line-items.js";
import { packSizeForBeerAsync } from "./beer-pack.js";
import { aestheticBufferForBeer, clearBeerBufferCache } from "./beer-buffer.js";
import { fetchUsageReport } from "./clover-usage.js";
import { getConfig } from "./clover.js";
import { supabaseConfig, supabaseHeaders } from "./supabase-rest.js";
import { lastCompleteSunSatWeek, lastNWeekRanges, sunSatWeekLabel } from "./week-calendar.js";

let parCache = null;
let parCacheKey = "";
let parCachedAt = 0;
const PAR_CACHE_MS = 5 * 60 * 1000;

function roundParToPack(units, packSize) {
  const pack = Math.max(1, Math.round(Number(packSize) || 1));
  const u = Number(units) || 0;
  if (u <= 0) return 0;
  return Math.ceil(u / pack) * pack;
}

async function upsertUsageWeekly(batch) {
  if (!batch.length) return;
  const { base, key } = supabaseConfig();
  if (!base || !key) {
    throw new Error(
      "Missing SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Vercel environment variables.",
    );
  }
  const res = await fetch(`${base}/rest/v1/usage_weekly`, {
    method: "POST",
    headers: supabaseHeaders(key, {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    }),
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase usage_weekly upsert failed: ${body.slice(0, 300)}`);
  }
}

export async function syncWeekRangeToSupabase(weekStart, weekEnd, { forceRefresh = false } = {}) {
  const cfg = getConfig();
  const report = await fetchUsageReport(weekStart, weekEnd, { forceRefresh });
  const now = new Date().toISOString();
  const batch = (report.items || []).map((item) => ({
    merchant_id: cfg.merchantId,
    week_start: weekStart,
    week_end: weekEnd,
    item_name: item.name,
    category_name: item.category_name || "",
    quantity_sold: Number(item.quantity_sold) || 0,
    gross_minor_units: Number(item.gross_minor_units) || 0,
    synced_at: now,
  }));
  await upsertUsageWeekly(batch);
  return {
    week_start: weekStart,
    week_end: weekEnd,
    items: batch.length,
    units: batch.reduce((s, r) => s + r.quantity_sold, 0),
  };
}

export async function syncWeeksToSupabase(weeks = 8, { forceRefresh = false } = {}) {
  const cfg = getConfig();
  const ranges = lastNWeekRanges(weeks);
  const syncedWeeks = [];
  let rowsUpserted = 0;
  for (const [weekStart, weekEnd] of ranges) {
    const one = await syncWeekRangeToSupabase(weekStart, weekEnd, { forceRefresh });
    syncedWeeks.push(one);
    rowsUpserted += one.items;
  }
  return {
    ok: true,
    merchant_id: cfg.merchantId,
    weeks_requested: weeks,
    weeks_synced: syncedWeeks,
    rows_upserted: rowsUpserted,
  };
}

async function weeksStoredInSupabase() {
  const { base, key, merchantId } = supabaseConfig();
  if (!base || !key) return 0;
  const res = await fetch(
    `${base}/rest/v1/usage_weekly?merchant_id=eq.${encodeURIComponent(merchantId)}&select=week_start`,
    { headers: supabaseHeaders(key) },
  );
  if (!res.ok) return 0;
  const rows = await res.json();
  return new Set(rows.map((r) => r.week_start).filter(Boolean)).size;
}

export function clearBeerParCache() {
  parCache = null;
  parCacheKey = "";
  parCachedAt = 0;
}

export async function suggestedParFromSupabase(weeks = 6, { forceRefresh = false } = {}) {
  const cfg = getConfig();
  const cacheKey = `${cfg.merchantId}:${weeks}`;
  if (!forceRefresh && parCache && parCacheKey === cacheKey && Date.now() - parCachedAt < PAR_CACHE_MS) {
    return { ...parCache, from_cache: true };
  }

  const { base, key, merchantId } = supabaseConfig();
  if (!base || !key) {
    throw new Error(
      "Missing SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Vercel environment variables.",
    );
  }

  const ranges = lastNWeekRanges(weeks);
  if (!ranges.length) throw new Error("No week ranges to average");

  const weekStarts = ranges.map(([ws]) => ws);
  const inList = weekStarts.map((ws) => `"${ws}"`).join(",");
  const res = await fetch(
    `${base}/rest/v1/usage_weekly?merchant_id=eq.${encodeURIComponent(merchantId)}&week_start=in.(${inList})&select=item_name,category_name,week_start,quantity_sold`,
    { headers: supabaseHeaders(key) },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase usage_weekly read failed: ${body.slice(0, 300)}`);
  }
  const rows = await res.json();

  const beerNames = Object.fromEntries(BEER_LINE_ITEMS.map((n) => [n.toLowerCase(), n]));
  const byItem = {};

  for (const row of rows) {
    const rawName = (row.item_name || "").trim();
    const canonical = canonicalBeerName(rawName) || rawName;
    const key = canonical.toLowerCase();
    if (!beerNames[key]) continue;
    if (!byItem[key]) {
      byItem[key] = { name: beerNames[key], category_name: "Beer", weekly_qty: {} };
    }
    byItem[key].weekly_qty[row.week_start] = Number(row.quantity_sold) || 0;
  }

  const itemsOut = [];
  for (const entry of Object.values(byItem)) {
    const beer = entry.name;
    const weekly = Object.values(entry.weekly_qty);
    const avgWeekly = weekly.reduce((s, q) => s + q, 0) / weeks;
    const pack = await packSizeForBeerAsync(null, beer);
    const buf = await aestheticBufferForBeer(beer);
    const basePar = roundParToPack(avgWeekly, pack);
    const watPar = basePar + buf.wat;
    const luPar = basePar + buf.lu;
    itemsOut.push({
      name: beer,
      category_name: entry.category_name,
      avg_weekly: Math.round(avgWeekly * 100) / 100,
      weeks_with_data: weekly.length,
      weeks_requested: weeks,
      pack_size: pack,
      usage_par: basePar,
      wat_buffer: buf.wat,
      lu_buffer: buf.lu,
      suggested_par: Math.max(watPar, luPar),
      wat_par: watPar,
      lu_par: luPar,
    });
  }

  const existing = new Set(itemsOut.map((i) => i.name.toLowerCase()));
  for (const canonical of BEER_LINE_ITEMS) {
    if (existing.has(canonical.toLowerCase())) continue;
    const pack = await packSizeForBeerAsync(null, canonical);
    const buf = await aestheticBufferForBeer(canonical);
    const basePar = roundParToPack(0, pack);
    const watPar = basePar + buf.wat;
    const luPar = basePar + buf.lu;
    itemsOut.push({
      name: canonical,
      category_name: "Beer",
      avg_weekly: 0,
      weeks_with_data: 0,
      weeks_requested: weeks,
      pack_size: pack,
      usage_par: basePar,
      wat_buffer: buf.wat,
      lu_buffer: buf.lu,
      suggested_par: Math.max(watPar, luPar),
      wat_par: watPar,
      lu_par: luPar,
    });
  }

  itemsOut.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const payload = {
    ok: true,
    merchant_id: cfg.merchantId,
    weeks,
    week_ranges: ranges.map(([start, end]) => ({ start, end })),
    items: itemsOut,
    scope: "beer",
    note:
      "Beer only: 6-week Sun–Sat average, rounded to pack size, plus aesthetic buffer per location (beer_aesthetic_buffer).",
    from_cache: false,
  };

  parCache = payload;
  parCacheKey = cacheKey;
  parCachedAt = Date.now();
  return payload;
}

export async function updateBeerParForOrders({
  forceRefresh = true,
  parWeeks = 6,
  bootstrapWeeks = 8,
} = {}) {
  const cfg = getConfig();
  const { start, end } = lastCompleteSunSatWeek();
  const storedWeeks = await weeksStoredInSupabase();

  let syncResult;
  let mode;
  if (storedWeeks < parWeeks) {
    syncResult = await syncWeeksToSupabase(bootstrapWeeks, { forceRefresh });
    mode = "bootstrap";
  } else {
    const one = await syncWeekRangeToSupabase(start, end, { forceRefresh });
    syncResult = {
      ok: true,
      merchant_id: cfg.merchantId,
      weeks_requested: 1,
      weeks_synced: [one],
      rows_upserted: one.items,
    };
    mode = "last_week";
  }

  clearBeerParCache();
  clearBeerBufferCache();
  const par = await suggestedParFromSupabase(parWeeks, { forceRefresh: true });

  return {
    ok: true,
    mode,
    order_week: {
      start,
      end,
      label: sunSatWeekLabel(start, end),
    },
    sync: syncResult,
    par,
  };
}
