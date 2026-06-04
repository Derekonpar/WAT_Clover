/** Hidden from Usage tab when category is "All" (still visible under Liquor filter). */
export const USAGE_ALL_VIEW_EXCLUDE = new Set([
  "patron cocktail use",
  "fireball shot/ cocktail use",
  "high noon black cherry",
]);

export function filterUsageAllView<T extends { name: string }>(items: T[]): T[] {
  return items.filter((r) => !USAGE_ALL_VIEW_EXCLUDE.has(r.name.trim().toLowerCase()));
}
