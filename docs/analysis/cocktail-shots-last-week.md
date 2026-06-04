# Cocktail → shot analysis (last week)

**Period:** Monday **2026-05-18** through Sunday **2026-05-24**  
**Source:** `Cocktail Recipes.pdf` (bar recipe book) + Clover API (Wild Axe merchant `F94ACDTMC3C51`)  
**Generated:** 2026-05-29

---

## Summary

| Metric | Liquor + shots (excl. beer SKUs) |
|--------|--------------------------------:|
| Total units sold | **207** |
| Items with sales | **16** |
| Gross revenue | **$2,018.00** |

**High Noon Pineapple** is tracked under **beer**, not liquor. In Clover it is categorized as **Liquor**, but the register name `High Noon Pinapple` is aliased to the beer SKU **High Noon Pineapple** (33 sold last week on the beer tab).

---

## Cocktails sold last week → spirits in the recipe book

| Qty | Clover item | Spirits / shots (from PDF) |
|----:|-------------|----------------------------|
| 27 | Old Fashion | **Woodford Reserve** (2 oz) |
| 27 | Wizards Spellbook | **Tito's** + blue dot / blue razz juice on top |
| 20 | Strawberry Marg | **Jose Cuervo or Patron** + triple sec, lime, strawberry |
| 17 | Cherry Wood | **Amaretto** |
| 15 | Bigfoot | **Maple Knob Creek** |
| 15 | Moscow Mule | **Tito's** |
| 14 | Dirty Shirley | **Tito's** |
| 14 | Slice Cream Float | **Cruzán vanilla rum** |
| 11 | The Enchanted Apple | **Crown Apple** + **Midori** |
| 5 | Blue Dot | **Blue Raspberry Svedka** |

**PDF cocktails with zero sales last week:** Apple Pie, Short n' Sweet, Jalapeño Marg, Tropical Gentleman, Lemon Drop, White Tea, PinkyPromise, Prince of Darkness.

---

## Standalone shots sold last week (Clover category: Shots)

| Qty | Clover item | Recipe book |
|----:|-------------|-------------|
| 9 | Crown Royal Apple Shot | Crown Apple (also in Enchanted Apple / Apple Pie) |
| 9 | Tito Shot | Tito's (Mule, Dirty Shirley, Spellbook, etc.) |
| 8 | Patron Shot | Patron option in margaritas |
| 8 | Captain Morgan Shot | SHOTS section |
| 6 | Jack Daniel Shot | SHOTS section |
| 2 | Woodford Reserve Shot | Woodford (Old Fashion) |

---

## Estimated spirit usage (cocktails + shots)

Each cocktail ≈ one primary pour unless noted. Margaritas are **Patron OR Cuervo** in the PDF (split unknown).

| Spirit / shot | Cocktail pours (est.) | Standalone shots | Est. total |
|---------------|----------------------:|-----------------:|-----------:|
| **Tito's** | 56 (Mule 15 + Dirty Shirley 14 + Spellbook 27) | 9 | **~65** |
| **Woodford** | 27 (Old Fashion) | 2 | **~29** |
| **Patron** | 20 (Strawberry Marg) | 8 | **~28** |
| **Crown Apple** | 11 (Enchanted Apple) | 9 | **~20** |
| **Amaretto** | 17 (Cherry Wood) | — | **~17** |
| **Maple Knob Creek** | 15 (Bigfoot) | — | **~15** |
| **Cruzán vanilla** | 14 (Slice Cream Float) | — | **~14** |
| **Blue Raspberry Svedka** | 5 (Blue Dot) | — | **5+** |
| **Captain Morgan** | — | 8 | **8** |
| **Jack Daniel's** | — | 6 | **6** |
| **Midori** | ~11 (partial, Enchanted Apple) | — | **~11** |

---

## Full recipe book → spirits (all PDF cocktails)

| Cocktail | Shots / spirits used |
|----------|---------------------|
| Cherrywood | Amaretto |
| Bigfoot | Maple Knob Creek |
| Apple Pie | Crown Apple, Fireball |
| Moscow Mule | Tito's |
| Old Fashion | Woodford Reserve |
| Short n' Sweet | Jose Cuervo **or** Patron |
| Enchanted Apple | Crown Apple, Midori |
| Tropical Gentleman | Woodford |
| Slice Cream Float | Cruzán vanilla rum |
| Margaritas (flavored) | Jose Cuervo **or** Patron |
| Jalapeño Marg | Jose Cuervo **or** Patron |
| Dirty Shirley | Tito's |
| Blue Dot | Blue Raspberry Svedka |
| Lemon Drop | Tito's, triple sec |
| White Tea | Tito's, peach schnapps |
| Wizards Spellbook | Tito's, blue dot juice |
| PinkyPromise | Bacardi rum |
| Prince of Darkness | Tito's, Midori |

---

## Beer SKUs sold from Clover “Liquor” category

These are in the **beer** allowlist and excluded from liquor tabs:

| Beer SKU | Clover register name | Last week (beer tab) |
|----------|----------------------|---------------------:|
| High Noon Pineapple | `High Noon Pinapple` | **33** |

---

## Takeaways

1. **Tito's** drives the most volume (~65 pours) via Mule, Dirty Shirley, Spellbook, and Tito shots.
2. **Woodford** is almost entirely **Old Fashion** (27) plus 2 Woodford shots.
3. **Captain Morgan** and **Jack Daniel's** moved only as standalone shots, not via named PDF cocktails.
4. Several PDF cocktails had **no sales** last week (Lemon Drop, White Tea, Apple Pie, etc.).

---

## Dashboard fix (High Noon)

Clover lists **High Noon Pinapple** under category **Liquor**. The app now:

- Maps `High Noon Pinapple` → beer SKU **High Noon Pineapple** (alias)
- Excludes any canonical beer SKU from liquor catalog and liquor usage
- Counts sales on **Beer usage** / **Beer inventory**, not liquor

Refresh **Liquor usage** with “Refresh from Clover” after deploy to clear cached counts that included High Noon.
