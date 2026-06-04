# Wild Axe — Sales & inventory analysis

This folder holds one-off analyses that support ordering and usage decisions.

| File | Description |
|------|-------------|
| [cocktail-shots-last-week.md](./cocktail-shots-last-week.md) | Cocktail recipes (from bar PDF) mapped to shots/spirits, cross-referenced with Clover liquor usage for last week |
| [../liquor-par-build.yaml](../liquor-par-build.yaml) | Fixed WAT/LU build-to-par for liquor & shots (seeded to Supabase `liquor_par`) |

**Source recipe book:** `~/Downloads/Cocktail Recipes.pdf` (7 pages, Wild Axe cocktail menu).

**Dashboard:** Run `./run_dashboard.sh` — **Beer usage**, **Liquor usage**, and inventory tabs use live Clover data.
