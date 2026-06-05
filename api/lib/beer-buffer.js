/** Aesthetic cooler buffer — Supabase beer_aesthetic_buffer (sync with scripts/beer_buffer.py). */
import { BEER_LINE_ITEMS } from "./beer-line-items.js";
import { supabaseConfig, supabaseHeaders } from "./supabase-rest.js";

const HIGH_BUFFER_BEERS = new Set(["michelob ultra", "miller lite", "modelo"]);
const DEFAULT_BUFFER = 18;
const HIGH_BUFFER = 36;

let cachedByBeer = null;
let cachedAt = 0;
const CACHE_MS = 5 * 60 * 1000;

function fallbackBuffer(beerName) {
  const n = HIGH_BUFFER_BEERS.has((beerName || "").trim().toLowerCase())
    ? HIGH_BUFFER
    : DEFAULT_BUFFER;
  return { wat: n, lu: n };
}

async function loadBuffersFromSupabase() {
  const { base, key, merchantId } = supabaseConfig();
  if (!base || !key) return null;
  if (cachedByBeer && Date.now() - cachedAt < CACHE_MS) return cachedByBeer;

  const res = await fetch(
    `${base}/rest/v1/beer_aesthetic_buffer?select=beer_name,wat_buffer,lu_buffer&merchant_id=eq.${encodeURIComponent(merchantId)}`,
    { headers: supabaseHeaders(key) },
  );
  const dbRows = {};
  if (res.ok) {
    for (const row of await res.json()) {
      const name = (row.beer_name || "").trim();
      if (name) {
        dbRows[name.toLowerCase()] = {
          wat: Number(row.wat_buffer) || 0,
          lu: Number(row.lu_buffer) || 0,
        };
      }
    }
  }

  const byBeer = {};
  for (const beer of BEER_LINE_ITEMS) {
    const row = dbRows[beer.toLowerCase()];
    byBeer[beer] =
      row && (row.wat > 0 || row.lu > 0) ? row : fallbackBuffer(beer);
  }
  cachedByBeer = byBeer;
  cachedAt = Date.now();
  return byBeer;
}

export async function aestheticBufferForBeer(beerName) {
  const byBeer = (await loadBuffersFromSupabase()) || {};
  const hit = Object.entries(byBeer).find(
    ([n]) => n.toLowerCase() === (beerName || "").trim().toLowerCase(),
  );
  return hit ? hit[1] : fallbackBuffer(beerName);
}

export function clearBeerBufferCache() {
  cachedByBeer = null;
  cachedAt = 0;
}
