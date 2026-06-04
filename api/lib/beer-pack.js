/** Beer case sizes — Supabase beer_pack_size with fallback (sync with scripts/beer_pack.py). */
const FALLBACK = {
  "Miller Lite": 12,
  Guinness: 12,
  "Blue Moon": 12,
  "Coors Light": 8,
  Modelo: 12,
  "Michelob Ultra": 24,
  Yuengling: 24,
  "Bud Light": 24,
  "Angry Orchard": 24,
  "High Noon Pineapple": 24,
  "Busch Light": 24,
  Truth: 24,
  "Boat Show (Yellow Springs)": 12,
};

let cachedByBeer = null;
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

async function loadPackSizesFromSupabase() {
  const { base, key, merchantId } = supabaseConfig();
  if (!base || !key || !merchantId) return null;
  if (cachedByBeer && Date.now() - cachedAt < CACHE_MS) return cachedByBeer;

  const res = await fetch(
    `${base}/rest/v1/beer_pack_size?merchant_id=eq.${encodeURIComponent(merchantId)}&select=beer_name,pack_size`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
    },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  const byBeer = { ...FALLBACK };
  for (const row of rows) {
    const name = (row.beer_name || "").trim();
    if (name) byBeer[name] = Number(row.pack_size) || FALLBACK[name] || 12;
  }
  cachedByBeer = byBeer;
  cachedAt = Date.now();
  return byBeer;
}

export async function packSizeForBeerAsync(_distributorId, beerName) {
  const byBeer = (await loadPackSizesFromSupabase()) || FALLBACK;
  const key = Object.keys(byBeer).find((k) => k.toLowerCase() === (beerName || "").trim().toLowerCase());
  return key ? byBeer[key] : 12;
}

/** Sync fallback (matches Supabase seed). */
export function packSizeForBeer(distributorId, beerName) {
  const beer = (beerName || "").trim();
  const hit = Object.entries(FALLBACK).find(([k]) => k.toLowerCase() === beer.toLowerCase());
  if (hit) return hit[1];
  if (distributorId === "heidelberg") return 24;
  if (distributorId === "yellow_springs") return 12;
  return 12;
}

export { FALLBACK as BEER_PACK_FALLBACK };
