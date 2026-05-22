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

export const DEFAULT_PAR = 40;

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
