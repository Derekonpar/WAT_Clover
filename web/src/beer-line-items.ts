/** Canonical SKUs — keep in sync with config.yaml and api/lib/beer-line-items.js */
export const BEER_LINE_ITEMS = [
  "Angry Orchard",
  "Blue Moon",
  "Boat Show (Yellow Springs)",
  "Bud Light",
  "Busch Light",
  "Coors Light",
  "Guinness",
  "High Noon Pineapple",
  "Michelob Ultra",
  "Miller Lite",
  "Modelo",
  "Truth",
  "Yuengling",
] as const;

/** Clover register names → canonical SKU */
export const LINE_ITEM_ALIASES: Record<string, string> = {
  "mic ultra": "Michelob Ultra",
  "michelob ultra": "Michelob Ultra",
  "budlight": "Bud Light",
  "bud light": "Bud Light",
  "hn pineapple": "High Noon Pineapple",
  "high noon pineapple": "High Noon Pineapple",
  "high noon pinneaple": "High Noon Pineapple",
  "high noon pinapple": "High Noon Pineapple",
};

/** Placeholder par before Supabase load (aesthetic buffer only — Michelob/Miller/Modelo 36, else 18). */
export const DEFAULT_PAR_BY_BEER: Record<(typeof BEER_LINE_ITEMS)[number], number> = {
  "Michelob Ultra": 36,
  "Miller Lite": 36,
  Modelo: 36,
  Guinness: 18,
  "Angry Orchard": 18,
  "High Noon Pineapple": 18,
  "Bud Light": 18,
  "Coors Light": 18,
  "Boat Show (Yellow Springs)": 18,
  Truth: 18,
  Yuengling: 18,
  "Busch Light": 18,
  "Blue Moon": 18,
};

export function defaultParForBeer(name: (typeof BEER_LINE_ITEMS)[number]): number {
  return DEFAULT_PAR_BY_BEER[name];
}

export type DistributorId = "bonbright" | "heidelberg" | "yellow_springs";

export type DistributorInfo = {
  id: DistributorId;
  label: string;
  email: string;
  beers: string[];
};

export const DISTRIBUTORS: DistributorInfo[] = [
  {
    id: "bonbright",
    label: "Bonbright",
    email: "avogt@bonbright.com",
    beers: ["Miller Lite", "Guinness", "Blue Moon", "Coors Light", "Modelo"],
  },
  {
    id: "heidelberg",
    label: "Heidelberg",
    email: "wes.feldmeyer@heidelbergdistributing.com",
    beers: [
      "Michelob Ultra",
      "Yuengling",
      "Bud Light",
      "Angry Orchard",
      "High Noon Pineapple",
      "Busch Light",
      "Truth",
    ],
  },
  {
    id: "yellow_springs",
    label: "Yellow Springs",
    email: "shawn@yellowspringsbrewery.com",
    beers: ["Boat Show (Yellow Springs)"],
  },
];

export function canonicalBeerName(lineName: string): string | null {
  const raw = (lineName || "").trim();
  if (!raw) return null;
  const alias = LINE_ITEM_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  const lower = raw.toLowerCase();
  return BEER_LINE_ITEMS.find((n) => n.toLowerCase() === lower) || null;
}

export function distributorForBeer(beerName: string): DistributorInfo | null {
  const canonical = canonicalBeerName(beerName) || beerName;
  for (const d of DISTRIBUTORS) {
    if (d.beers.some((b) => b.toLowerCase() === canonical.toLowerCase())) return d;
  }
  return null;
}
