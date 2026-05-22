/** Case/pack sizes per distributor (units per pack). */
export function packSizeForBeer(distributorId, beerName) {
  const beer = (beerName || "").trim().toLowerCase();
  if (distributorId === "bonbright") {
    return beer === "coors light" ? 8 : 12;
  }
  if (distributorId === "heidelberg") {
    return 24;
  }
  if (distributorId === "yellow_springs") {
    return 12;
  }
  return 12;
}

export function normalizeToPacks(unitsNeeded, packSize) {
  const units = Math.max(0, Math.round(Number(unitsNeeded) || 0));
  const size = Math.max(1, Math.round(Number(packSize) || 1));
  if (units === 0) {
    return { unitsNeeded: 0, packSize: size, packs: 0, unitsOrdered: 0 };
  }
  const packs = Math.ceil(units / size);
  return {
    unitsNeeded: units,
    packSize: size,
    packs,
    unitsOrdered: packs * size,
  };
}
