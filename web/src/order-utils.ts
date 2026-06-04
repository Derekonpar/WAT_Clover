import {
  BEER_LINE_ITEMS,
  canonicalBeerName,
  distributorForBeer,
  type DistributorId,
} from "./beer-line-items";

export type InventoryLineInput = {
  name: string;
  onHand: number;
  par: number;
  orderQty: number;
  watOnHand?: number;
  luOnHand?: number;
  watPar?: number;
  luPar?: number;
};

export type PackLine = {
  name: string;
  onHand: number;
  par: number;
  unitsNeeded: number;
  packSize: number;
  packs: number;
  unitsOrdered: number;
};

export type DistributorOrder = {
  distributorId: DistributorId;
  distributor: string;
  to: string;
  lines: PackLine[];
};

export function packSizeForBeer(distributorId: DistributorId, beerName: string): number {
  const beer = beerName.trim().toLowerCase();
  if (distributorId === "bonbright") return beer === "coors light" ? 8 : 12;
  if (distributorId === "heidelberg") return 24;
  if (distributorId === "yellow_springs") return 12;
  return 12;
}

export function normalizeToPacks(unitsNeeded: number, packSize: number) {
  const units = Math.max(0, Math.round(unitsNeeded));
  if (units === 0) return { packs: 0, unitsOrdered: 0 };
  const packs = Math.ceil(units / packSize);
  return { packs, unitsOrdered: packs * packSize };
}

export function buildDistributorOrdersFromLines(
  lines: InventoryLineInput[],
): DistributorOrder[] {
  const byDist = new Map<DistributorId, DistributorOrder>();

  for (const line of lines) {
    if (line.orderQty <= 0) continue;
    const name = canonicalBeerName(line.name) || line.name;
    const dist = distributorForBeer(name);
    if (!dist) continue;

    const packSize = packSizeForBeer(dist.id, name);
    const { packs, unitsOrdered } = normalizeToPacks(line.orderQty, packSize);

    if (!byDist.has(dist.id)) {
      byDist.set(dist.id, {
        distributorId: dist.id,
        distributor: dist.label,
        to: dist.email,
        lines: [],
      });
    }

    byDist.get(dist.id)!.lines.push({
      name,
      onHand: line.onHand,
      par: line.par,
      unitsNeeded: line.orderQty,
      packSize,
      packs,
      unitsOrdered,
    });
  }

  return [...byDist.values()];
}

export function formatEmailBody(distLabel: string, lines: PackLine[]) {
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

export { BEER_LINE_ITEMS };
