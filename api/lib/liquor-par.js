/** Liquor par from Supabase liquor_par (sync with scripts/liquor_par.py). */
import { fetchLiquorInventoryCatalog } from "./clover-catalog.js";
import { getConfig } from "./clover.js";

/** Fallback when Supabase table empty — sync with docs/liquor-par-build.yaml */
const BUILD_FALLBACK = {
  "tito shot": { wat: 4, lu: 4 },
  "patron shot": { wat: 4, lu: 4 },
  "crown royal apple shot": { wat: 4, lu: 4 },
  "captain morgan shot": { wat: 4, lu: 4 },
  "jack daniel shot": { wat: 4, lu: 4 },
  "woodford reserve shot": { wat: 4, lu: 4 },
  amaretto: { wat: 4, lu: 4 },
  "svedka blue raspberry": { wat: 4, lu: 4 },
  "knobb creek maple": { wat: 4, lu: 4 },
  "cruzan vanilla": { wat: 4, lu: 4 },
  "triple sec": { wat: 4, lu: 4 },
  "strawberry pucker": { wat: 4, lu: 4 },
  "orange bitters": { wat: 4, lu: 4 },
  midori: { wat: 4, lu: 4 },
  "simple syrup": { wat: 4, lu: 4 },
  grenadine: { wat: 4, lu: 4 },
  "sour mix": { wat: 4, lu: 4 },
};

let cachedPayload = null;
let cachedAt = 0;
const CACHE_MS = 5 * 60 * 1000;

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const projectId = (process.env.SUPABASE_PROJECT_ID || "").trim();
  const base = url || (projectId ? `https://${projectId}.supabase.co` : "");
  const key =
    (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim() ||
    (process.env.SUPABASE_PUBLISHABLE_KEY || "").trim() ||
    (process.env.SUPABASE_ANON_KEY || "").trim();
  const merchantId = (process.env.CLOVER_MERCHANT_ID || "").trim();
  return { base, key, merchantId };
}

async function loadParFromSupabase(merchantId) {
  const { base, key } = supabaseConfig();
  if (!base || !key) return {};

  const res = await fetch(
    `${base}/rest/v1/liquor_par?merchant_id=eq.${encodeURIComponent(merchantId)}&select=item_name,wat_par,lu_par`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
    },
  );
  if (!res.ok) return {};

  const rows = await res.json();
  const out = {};
  for (const row of rows) {
    const name = (row.item_name || "").trim();
    if (name) {
      out[name.toLowerCase()] = {
        wat: Number(row.wat_par) || 0,
        lu: Number(row.lu_par) || 0,
        source: "database",
      };
    }
  }
  return out;
}

export async function liquorParFromSupabase({ forceRefresh = false } = {}) {
  const cfg = getConfig();
  const cacheKey = cfg.merchantId;

  if (!forceRefresh && cachedPayload?.merchant_id === cacheKey && Date.now() - cachedAt < CACHE_MS) {
    return { ...cachedPayload, from_cache: true };
  }

  const catalog = await fetchLiquorInventoryCatalog({ forceRefresh });
  const dbRows = await loadParFromSupabase(cfg.merchantId);

  const items = (catalog.items || []).map((reg) => {
    const key = reg.name.toLowerCase();
    const fromDb = dbRows[key];
    const fromBuild = BUILD_FALLBACK[key];
    const pars = fromDb || fromBuild;
    const source = fromDb ? fromDb.source : fromBuild ? "build_file" : "unset";
    const wat = pars?.wat ?? 0;
    const lu = pars?.lu ?? 0;
    return {
      name: reg.name,
      category_name: reg.category_name || "",
      wat_par: wat,
      lu_par: lu,
      source,
    };
  });

  items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const payload = {
    ok: true,
    merchant_id: cfg.merchantId,
    items,
    note: "Liquor par is fixed in Supabase liquor_par (not usage-based).",
    from_cache: false,
  };

  cachedPayload = payload;
  cachedAt = Date.now();
  return payload;
}
