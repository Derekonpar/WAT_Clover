/** Provi product map — sync with scripts/liquor_provi_map.py and 006_liquor_provi_product.sql */
export const LIQUOR_PROVI_FALLBACK = {
  Amaretto: { provi_product_id: "0071B", order_via: "catalog" },
  "Svedka Blue Raspberry": { provi_product_id: "8867B", order_via: "catalog" },
  "Knobb Creek Maple": { provi_product_id: "5480B", order_via: "catalog" },
  "Crown Royal Apple Shot": { provi_product_id: "2383L", order_via: "catalog" },
  "Captain Morgan Shot": { provi_product_id: "1755L", order_via: "catalog" },
  "Woodford Reserve Shot": { provi_product_id: "9674L", order_via: "catalog" },
  "Tito Shot": { provi_product_id: "9232L", order_via: "catalog" },
  "Patron Shot": { provi_product_id: "7984B", order_via: "catalog" },
  "Jack Daniel Shot": { provi_product_id: "0066L", order_via: "catalog" },
  "Cruzan Vanilla": { provi_product_id: null, order_via: "rep_notes" },
  "Triple Sec": { provi_product_id: null, order_via: "rep_notes" },
  "Strawberry Pucker": { provi_product_id: null, order_via: "rep_notes" },
  "Orange bitters": { provi_product_id: null, order_via: "rep_notes" },
  Midori: { provi_product_id: null, order_via: "rep_notes" },
  "Simple Syrup": { provi_product_id: null, order_via: "rep_notes" },
  Grenadine: { provi_product_id: null, order_via: "rep_notes" },
  "Sour mix": { provi_product_id: null, order_via: "rep_notes" },
};

export function lookupProviProduct(name) {
  const key = Object.keys(LIQUOR_PROVI_FALLBACK).find(
    (k) => k.toLowerCase() === (name || "").trim().toLowerCase(),
  );
  return key ? { item_name: key, ...LIQUOR_PROVI_FALLBACK[key] } : null;
}

export function formatRepNotes(lines) {
  return lines.map((l) => `${l.name}: ${l.units_needed}`).join("; ");
}

export function buildProviLiquorOrder(lines) {
  const catalogLines = [];
  const repNotesLines = [];
  const unmapped = [];

  for (const line of lines) {
    const name = (line.name || "").trim();
    if (!name) continue;
    const orderQty = Math.max(0, Math.round(Number(line.orderQty) || 0));
    if (orderQty <= 0) continue;

    const mapping = lookupProviProduct(name);
    if (!mapping) {
      unmapped.push(name);
      continue;
    }

    const base = {
      name,
      units_needed: orderQty,
      on_hand: line.onHand,
      par: line.par,
      wat_on_hand: line.watOnHand,
      lu_on_hand: line.luOnHand,
      wat_par: line.watPar,
      lu_par: line.luPar,
    };

    if (mapping.order_via === "rep_notes") {
      repNotesLines.push(base);
    } else if (mapping.provi_product_id) {
      catalogLines.push({ ...base, provi_product_id: mapping.provi_product_id });
    } else {
      unmapped.push(name);
    }
  }

  if (!catalogLines.length && !repNotesLines.length) {
    throw new Error("No liquor items need ordering.");
  }
  if (unmapped.length) {
    throw new Error(`Missing Provi mapping for: ${unmapped.sort().join(", ")}`);
  }

  return {
    catalog_lines: catalogLines,
    rep_notes_lines: repNotesLines,
    rep_notes_text: formatRepNotes(repNotesLines),
  };
}
