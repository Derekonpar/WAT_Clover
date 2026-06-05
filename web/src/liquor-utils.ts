export type CatalogItem = {
  id: string;
  name: string;
  category_name: string;
};

export type LiquorLineInput = {
  name: string;
  onHand: number;
  par: number;
  orderQty: number;
  watOnHand?: number;
  luOnHand?: number;
  watPar?: number;
  luPar?: number;
  backupOnHand?: number;
  backupPar?: number;
};

export type LiquorCatalogLine = {
  name: string;
  provi_product_id: string;
  units_needed: number;
  on_hand?: number;
  par?: number;
  wat_on_hand?: number;
  lu_on_hand?: number;
  wat_par?: number;
  lu_par?: number;
};

export type LiquorRepNotesLine = {
  name: string;
  units_needed: number;
  on_hand?: number;
  par?: number;
};

export type LiquorProviOrder = {
  catalog_lines: LiquorCatalogLine[];
  rep_notes_lines: LiquorRepNotesLine[];
  rep_notes_text: string;
};

/** Front cooler par (WAT + LU each). Backup par is always LIQUOR_BACKUP_PAR. */
export const LIQUOR_FRONT_PAR_DEFAULT = 4;
export const LIQUOR_BACKUP_PAR = 4;
const LIQUOR_FRONT_PAR_OVERRIDES: Record<string, number> = {
  midori: 3,
};

export function liquorFrontParForItem(name: string): number {
  return LIQUOR_FRONT_PAR_OVERRIDES[name.trim().toLowerCase()] ?? LIQUOR_FRONT_PAR_DEFAULT;
}

export function liquorBackupParForItem(_name: string): number {
  return LIQUOR_BACKUP_PAR;
}

export function formatRepNotes(lines: LiquorRepNotesLine[]): string {
  return lines.map((l) => `${l.name}: ${l.units_needed}`).join("; ");
}

export function formatCatalogSummary(lines: LiquorCatalogLine[]): string {
  return lines
    .map((l) => `${l.provi_product_id} — ${l.name}: ${l.units_needed}`)
    .join("\n");
}
