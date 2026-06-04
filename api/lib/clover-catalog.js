import { BEER_LINE_ITEMS, canonicalBeerName } from "./beer-line-items.js";
import { applyLiquorShotDedupe } from "./liquor-shot-dedupe.js";
import { filterLiquorCatalogExcluded, filterLiquorForInventory } from "./liquor-inventory.js";
import { getConfig } from "./clover.js";

const DEFAULT_LIQUOR_CATEGORIES = ["Liquor", "Wine", "Cocktail"];
const LIQUOR_HINTS = ["liquor", "wine", "cocktail", "spirit", "shot"];
const BEER_CATEGORY = (process.env.CLOVER_SALES_CATEGORY || "Beer").trim().toLowerCase();
const memoryCache = new Map();
const CACHE_TTL_MS = (Number(process.env.CLOVER_CACHE_TTL_HOURS) || 24) * 3600 * 1000;
const PAGE_DELAY_MS = Number(process.env.CLOVER_REQUEST_DELAY_MS) || 300;

function liquorCategoryFilters() {
  const raw = (process.env.CLOVER_LIQUOR_CATEGORIES || "").trim();
  if (raw) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [...DEFAULT_LIQUOR_CATEGORIES];
}

function categoryMatchesLiquor(catName, filters) {
  const cat = (catName || "").trim();
  if (!cat) return false;
  const lower = cat.toLowerCase();
  if (lower === BEER_CATEGORY) return false;
  const filterLowers = new Set(filters.map((f) => f.toLowerCase()));
  if (filterLowers.has(lower)) return true;
  return LIQUOR_HINTS.some((h) => lower.includes(h));
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function paginateItems(cfg) {
  const pageSize = 100;
  const maxPages = 30;
  const all = [];
  for (let page = 0, offset = 0; page < maxPages; page++, offset += pageSize) {
    if (page > 0) await sleep(PAGE_DELAY_MS);
    const data = await cloverGet(cfg, "items", {
      limit: pageSize,
      offset,
      expand: "categories",
    });
    const rows = data.elements || [];
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

async function loadLiquorCatalog({ forceRefresh = false } = {}) {
  const cfg = getConfig();
  const filters = liquorCategoryFilters();
  const cacheKey = `liquor_catalog_v4:${cfg.merchantId}:${filters.join(",").toLowerCase()}`;

  if (!forceRefresh) {
    const hit = memoryCache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return { ...hit.data, from_cache: true };
    }
  }

  const beerNames = new Set(BEER_LINE_ITEMS.map((n) => n.toLowerCase()));
  const items = await paginateItems(cfg);
  const byName = new Map();

  for (const item of items) {
    const id = item.id;
    const name = (item.name || "").trim();
    if (!id || !name || beerNames.has(name.toLowerCase()) || canonicalBeerName(name)) {
      continue;
    }
    const categories = item.categories?.elements || [];
    const catName = categories[0]?.name?.trim() || "";
    if (!categoryMatchesLiquor(catName, filters)) continue;
    byName.set(name.toLowerCase(), { id, name, category_name: catName });
  }

  const catalog = [...byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  const { items: filtered, nameRemap, idRemap } = applyLiquorShotDedupe(catalog);
  const afterExclude = filterLiquorCatalogExcluded(filtered);
  const idRemapIds = Object.fromEntries(
    Object.entries(idRemap).map(([fromId, toItem]) => [fromId, toItem.id]),
  );

  const data = {
    categories: filters,
    items: afterExclude,
    count: afterExclude.length,
    liquor_to_shot_remap: nameRemap,
    dedupe_id_remap: idRemapIds,
    from_cache: false,
  };
  memoryCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

/** Full catalog for usage (includes cocktail menu items). */
export async function fetchLiquorCatalog(opts = {}) {
  return loadLiquorCatalog(opts);
}

/** Inventory tab: shots + pour bottles only. */
export async function fetchLiquorInventoryCatalog(opts = {}) {
  const full = await loadLiquorCatalog(opts);
  const items = filterLiquorForInventory(full.items);
  return {
    ...full,
    items,
    count: items.length,
    scope: "inventory",
  };
}
