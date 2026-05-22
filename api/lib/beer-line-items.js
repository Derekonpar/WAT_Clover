/** Canonical beer SKUs — exact line-item name match only. */
export const BEER_LINE_ITEMS = [
  "Angry Orchard",
  "Best Day IPA",
  "Blue Moon",
  "Boat Show (Yellow Springs)",
  "Bud Light",
  "Busch Light",
  "Coors Light",
  "Guinness",
  "Michelob Ultra",
  "Miller Lite",
  "Modelo",
  "Truth",
  "Yuengling",
];

export function canonicalBeerName(lineName) {
  const raw = (lineName || "").trim();
  if (!raw) return null;
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
