/** Canonical SKUs — keep in sync with config.yaml and web/src/beer-line-items.ts */
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
];

export const LINE_ITEM_ALIASES = {
  "mic ultra": "Michelob Ultra",
  "michelob ultra": "Michelob Ultra",
  budlight: "Bud Light",
  "bud light": "Bud Light",
  "hn pineapple": "High Noon Pineapple",
  "high noon pineapple": "High Noon Pineapple",
  "high noon pinneaple": "High Noon Pineapple",
};

export function canonicalBeerName(lineName) {
  const raw = (lineName || "").trim();
  if (!raw) return null;
  const alias = LINE_ITEM_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  const lower = raw.toLowerCase();
  return BEER_LINE_ITEMS.find((n) => n.toLowerCase() === lower) || null;
}

export function emptyBeerRows() {
  return Object.fromEntries(
    BEER_LINE_ITEMS.map((name) => [
      name.toLowerCase(),
      {
        name,
        category: "beer",
        category_name: "Beer",
        quantity_sold: 0,
        gross_minor_units: 0,
        line_count: 0,
      },
    ]),
  );
}
