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
};

/** Default par level per beer (units), rounded up to a multiple of 24. */
export const DEFAULT_PAR_BY_BEER: Record<(typeof BEER_LINE_ITEMS)[number], number> = {
  "Michelob Ultra": 216,
  "Miller Lite": 264,
  Modelo: 144,
  Guinness: 24,
  "Angry Orchard": 24,
  "High Noon Pineapple": 24,
  "Bud Light": 144,
  "Coors Light": 144,
  "Boat Show (Yellow Springs)": 72,
  Truth: 96,
  Yuengling: 48,
  "Busch Light": 48,
  "Blue Moon": 48,
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
