/** Items excluded from liquor usage and inventory. */
export const LIQUOR_CATALOG_EXCLUDE = new Set([
  "patron cocktail use",
  "fireball shot/ cocktail use",
]);

export function filterLiquorCatalogExcluded(items) {
  return items.filter((item) => !LIQUOR_CATALOG_EXCLUDE.has(item.name.toLowerCase()));
}

/** Pour bottles on inventory tab — keep in sync with config.yaml `liquor_inventory_extra`. */
export const LIQUOR_INVENTORY_EXTRA = [
  "Amaretto",
  "Svedka Blue Raspberry",
  "Knobb Creek Maple",
  "Cruzan Vanilla",
  "Triple Sec",
  "Strawberry Pucker",
  "Orange bitters",
  "Midori",
  "Simple Syrup",
  "Grenadine",
  "Sour mix",
];

export function filterLiquorForInventory(items) {
  const extraNames = LIQUOR_INVENTORY_EXTRA;
  const extra = new Set(extraNames.map((n) => n.toLowerCase()));
  const out = [];
  const seen = new Set();

  for (const item of items) {
    const cat = (item.category_name || "").toLowerCase();
    const name = item.name.toLowerCase();
    if (cat === "shots" || extra.has(name)) {
      out.push(item);
      seen.add(name);
    }
  }

  for (const name of extraNames) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    const slug = key.replace(/\s+/g, "-").replace(/\//g, "-");
    out.push({
      id: `inventory-extra:${slug}`,
      name,
      category_name: "Pour",
    });
    seen.add(key);
  }

  return out.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}
