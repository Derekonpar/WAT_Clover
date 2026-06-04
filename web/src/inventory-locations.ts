/** Wild Axe locations — separate on-hand and par per site. */
export type LocationField = "watOnHand" | "luOnHand" | "watPar" | "luPar";

/** User-editable fields (par is read-only from Supabase). */
export type OnHandField = "watOnHand" | "luOnHand";

export type TwoLocationCounts = {
  watOnHand: string;
  luOnHand: string;
  watPar: string;
  luPar: string;
};

export type ParsedTwoLocationRow = TwoLocationCounts & {
  watOnHandNum: number | null;
  luOnHandNum: number | null;
  watParNum: number | null;
  luParNum: number | null;
  orderQty: number | null;
};

function parseNonNegative(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

export function defaultLocationCounts(defaultPar: string): TwoLocationCounts {
  return {
    watOnHand: "",
    luOnHand: "",
    watPar: defaultPar,
    luPar: defaultPar,
  };
}

/** Migrate legacy single on-hand / par fields to WAT + LU. */
export function migrateLocationCounts(
  row: Partial<TwoLocationCounts> & { onHand?: string; par?: string },
  defaultPar: string,
): TwoLocationCounts {
  if (
    row.watOnHand !== undefined ||
    row.luOnHand !== undefined ||
    row.watPar !== undefined ||
    row.luPar !== undefined
  ) {
    return {
      watOnHand: row.watOnHand ?? "",
      luOnHand: row.luOnHand ?? "",
      watPar: row.watPar ?? defaultPar,
      luPar: row.luPar ?? defaultPar,
    };
  }
  const par = row.par ?? defaultPar;
  const onHand = row.onHand ?? "";
  return {
    watOnHand: onHand,
    luOnHand: onHand,
    watPar: par,
    luPar: par,
  };
}

export function parseTwoLocationRow(row: TwoLocationCounts): ParsedTwoLocationRow {
  const watOnHandNum = parseNonNegative(row.watOnHand);
  const luOnHandNum = parseNonNegative(row.luOnHand);
  const watParNum = parseNonNegative(row.watPar);
  const luParNum = parseNonNegative(row.luPar);

  const allFilled =
    watOnHandNum != null &&
    luOnHandNum != null &&
    watParNum != null &&
    luParNum != null;

  const orderQty = allFilled
    ? Math.max(0, Math.round(watParNum - watOnHandNum)) +
      Math.max(0, Math.round(luParNum - luOnHandNum))
    : null;

  return {
    ...row,
    watOnHandNum,
    luOnHandNum,
    watParNum,
    luParNum,
    orderQty,
  };
}

export function rowAllLocationsFilled(parsed: ParsedTwoLocationRow): boolean {
  return (
    parsed.watOnHandNum != null &&
    parsed.luOnHandNum != null &&
    parsed.watParNum != null &&
    parsed.luParNum != null
  );
}

/** Ready to compute need: on-hand entered and par loaded from database (> 0). */
export function rowReadyForOrder(parsed: ParsedTwoLocationRow): boolean {
  return (
    parsed.watOnHandNum != null &&
    parsed.luOnHandNum != null &&
    parsed.watParNum != null &&
    parsed.luParNum != null &&
    parsed.watParNum > 0 &&
    parsed.luParNum > 0
  );
}

export type OrderLineWithLocations = {
  name: string;
  onHand: number;
  par: number;
  orderQty: number;
  watOnHand: number;
  luOnHand: number;
  watPar: number;
  luPar: number;
};

export function toOrderLine(name: string, parsed: ParsedTwoLocationRow): OrderLineWithLocations {
  return {
    name,
    watOnHand: parsed.watOnHandNum!,
    luOnHand: parsed.luOnHandNum!,
    watPar: parsed.watParNum!,
    luPar: parsed.luParNum!,
    onHand: parsed.watOnHandNum! + parsed.luOnHandNum!,
    par: parsed.watParNum! + parsed.luParNum!,
    orderQty: parsed.orderQty!,
  };
}

export function formatLocationPair(
  wat: number,
  lu: number,
  sep = " / ",
): string {
  return `WAT ${wat}${sep}LU ${lu}`;
}
