import { canonicalBeerName } from "./beer-line-items.js";
import { DISTRIBUTORS, distributorForBeer, resolveEmail } from "./distributors.js";
import { normalizeToPacks, packSizeForBeer } from "./packs.js";

export function buildLineWithPacks(line) {
  const name = canonicalBeerName(line.name) || line.name;
  const dist = distributorForBeer(name);
  if (!dist) {
    return { ...line, name, distributor: null, pack: null };
  }
  const packSize = packSizeForBeer(dist.id, name);
  const pack = normalizeToPacks(line.orderQty, packSize);
  return {
    name,
    onHand: line.onHand,
    par: line.par,
    orderQty: line.orderQty,
    distributorId: dist.id,
    distributor: dist.label,
    distributorEmail: resolveEmail(dist),
    packSize: pack.packSize,
    packs: pack.packs,
    unitsOrdered: pack.unitsOrdered,
    unitsNeeded: pack.unitsNeeded,
  };
}

export function buildDistributorOrders(lines) {
  const built = [];
  const skipped = [];

  for (const line of lines) {
    const orderQty = Math.max(0, Math.round(Number(line.orderQty) || 0));
    if (orderQty <= 0) continue;
    const row = buildLineWithPacks({
      name: line.name,
      onHand: line.onHand,
      par: line.par,
      orderQty,
    });
    if (!row.distributor) {
      skipped.push(row);
      continue;
    }
    built.push(row);
  }

  const byDist = new Map();
  for (const row of built) {
    if (!byDist.has(row.distributorId)) {
      byDist.set(row.distributorId, {
        distributorId: row.distributorId,
        distributor: row.distributor,
        to: row.distributorEmail,
        lines: [],
      });
    }
    byDist.get(row.distributorId).lines.push(row);
  }

  return {
    distributors: [...byDist.values()],
    skipped,
  };
}

export function formatOrderEmailBody(distLabel, lines) {
  const items = lines
    .map(
      (l) =>
        `  - ${l.name}: ${l.packs} case${l.packs === 1 ? "" : "s"} (${l.packSize}-pack)`,
    )
    .join("\n");
  return [
    `Hello ${distLabel},`,
    "",
    "For this week, we would like:",
    "",
    items,
    "",
    "Thank you,",
    "Wild Axe Throwing",
  ].join("\n");
}

export function buildEmailPreviews(distributorOrders) {
  return distributorOrders.map((d) => ({
    distributor: d.distributor,
    distributorId: d.distributorId,
    to: d.to,
    subject: `Wild Axe Throwing — weekly beer order`,
    body: formatOrderEmailBody(d.distributor, d.lines),
    lines: d.lines.map((l) => ({
      name: l.name,
      onHand: l.onHand,
      par: l.par,
      unitsNeeded: l.unitsNeeded,
      packSize: l.packSize,
      packs: l.packs,
      unitsOrdered: l.unitsOrdered,
    })),
  }));
}
