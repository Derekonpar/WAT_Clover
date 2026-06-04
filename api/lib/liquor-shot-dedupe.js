/**
 * Liquor SKUs to hide when a Shots-category counterpart exists.
 * Keep in sync with config.yaml `liquor_drop_for_shots` and scripts/liquor_shot_dedupe.py
 */
export const LIQUOR_DROP_FOR_SHOTS = {
  "Patron SHOT ONLY": "Patron Shot",
  "Crown Apple Whiskey": "Crown Royal Apple Shot",
  "Jack Daniel's Whiskey": "Jack Daniel Shot",
  "Captain Morgan Rum": "Captain Morgan Shot",
  "Woodford Reserve": "Woodford Reserve Shot",
  "Titos Vodka": "Tito Shot",
};

function autoShotOnlyPairs(items, dropMap) {
  const shots = items
    .filter((i) => (i.category_name || "").toLowerCase() === "shots")
    .map((i) => i.name);
  const configured = new Set(Object.keys(dropMap).map((k) => k.toLowerCase()));
  const extras = {};
  for (const item of items) {
    if ((item.category_name || "").toLowerCase() !== "liquor") continue;
    if (configured.has(item.name.toLowerCase())) continue;
    if (!item.name.toLowerCase().includes("shot only")) continue;
    const token = item.name.split(/\s+/)[0]?.toLowerCase();
    const match = shots.find((s) => s.toLowerCase().startsWith(token));
    if (match) extras[item.name] = match;
  }
  return extras;
}

export function applyLiquorShotDedupe(items) {
  const dropMap = { ...LIQUOR_DROP_FOR_SHOTS, ...autoShotOnlyPairs(items, LIQUOR_DROP_FOR_SHOTS) };
  const byName = Object.fromEntries(items.map((i) => [i.name, i]));
  const shotNames = new Set(
    items.filter((i) => (i.category_name || "").toLowerCase() === "shots").map((i) => i.name.toLowerCase()),
  );

  const exclude = new Set();
  const nameRemap = {};
  for (const [liquorName, shotName] of Object.entries(dropMap)) {
    if (!shotNames.has(shotName.toLowerCase())) continue;
    if (!items.some((i) => i.name.toLowerCase() === liquorName.toLowerCase())) continue;
    exclude.add(liquorName.toLowerCase());
    nameRemap[liquorName.toLowerCase()] = shotName;
  }

  const idRemap = {};
  const filtered = [];
  for (const item of items) {
    if (exclude.has(item.name.toLowerCase())) {
      const shotName = nameRemap[item.name.toLowerCase()];
      const shotItem = byName[shotName];
      if (shotItem?.id && item.id) idRemap[item.id] = shotItem;
      continue;
    }
    filtered.push(item);
  }

  return { items: filtered, nameRemap, idRemap };
}

export function resolveLiquorLineWithDedupe(registry, line) {
  const rawName = (line.name || "").trim();
  const { nameRemap, idRemap, byId, byName } = registry;
  const itemId = line.item?.id;

  if (itemId && idRemap[itemId]) return idRemap[itemId];
  if (rawName && nameRemap[rawName.toLowerCase()]) {
    return byName[nameRemap[rawName.toLowerCase()].toLowerCase()];
  }
  if (itemId && byId[itemId]) return byId[itemId];
  if (rawName && byName[rawName.toLowerCase()]) return byName[rawName.toLowerCase()];
  return null;
}
