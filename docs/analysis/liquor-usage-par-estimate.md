# Liquor & mixer usage — par estimate (Supabase only)

**Merchant:** `F94ACDTMC3C51`  
**Weeks analyzed:** 1  
**Week starts:** 2026-05-18  
**Generated:** 2026-06-05T14:22:15.350209+00:00

## Assumptions

- Data source: Supabase usage_weekly only (no live Clover calls).
- Cocktail oz from Cocktail Recipes.pdf mapped to liquor inventory tab items.
- Spirits listed without oz in PDF assumed 1.25 oz pour; standalone shots 1.5 oz each.
- Margarita spirit credited to Patron Shot (Cuervo not in inventory tab).
- Bottle sizes: 1 L (33.8 oz) default; Patron, Midori, Knobb Creek Maple, Svedka = 750 mL (25.4 oz).

## Inventory totals (cocktails + standalone shots)

| Item | Total oz | Avg oz/wk | Oz cocktails | Oz shots | Shots sold | Avg shots/wk | Bottle (oz) | Avg bottles/wk | Wks/bottle |
|------|--------:|----------:|-------------:|---------:|-----------:|-------------:|------------:|---------------:|-----------:|
| Tito Shot | 83.5 | 83.5 | 70.0 | 13.5 | 9 | 9.0 | 33.814 | 2.469 | 0.4 |
| Sour mix | 81.0 | 81.0 | 81.0 | 0.0 | 0 | 0.0 | 33.814 | 2.395 | 0.4 |
| Woodford Reserve Shot | 57.0 | 57.0 | 54.0 | 3.0 | 2 | 2.0 | 33.814 | 1.686 | 0.6 |
| Strawberry Pucker | 40.0 | 40.0 | 40.0 | 0.0 | 0 | 0.0 | 33.814 | 1.183 | 0.8 |
| Patron Shot | 37.0 | 37.0 | 25.0 | 12.0 | 8 | 8.0 | 25.36 | 1.459 | 0.7 |
| Crown Royal Apple Shot | 27.25 | 27.25 | 13.75 | 13.5 | 9 | 9.0 | 33.814 | 0.806 | 1.2 |
| Triple Sec | 25.0 | 25.0 | 25.0 | 0.0 | 0 | 0.0 | 33.814 | 0.739 | 1.4 |
| Amaretto | 21.25 | 21.25 | 21.25 | 0.0 | 0 | 0.0 | 33.814 | 0.628 | 1.6 |
| Knobb Creek Maple | 18.75 | 18.75 | 18.75 | 0.0 | 0 | 0.0 | 25.36 | 0.739 | 1.4 |
| Cruzan Vanilla | 17.5 | 17.5 | 17.5 | 0.0 | 0 | 0.0 | 33.814 | 0.518 | 1.9 |
| Captain Morgan Shot | 12.0 | 12.0 | 0.0 | 12.0 | 8 | 8.0 | 33.814 | 0.355 | 2.8 |
| Simple Syrup | 9.5 | 9.5 | 9.5 | 0.0 | 0 | 0.0 | 33.814 | 0.281 | 3.6 |
| Jack Daniel Shot | 9.0 | 9.0 | 0.0 | 9.0 | 6 | 6.0 | 33.814 | 0.266 | 3.8 |
| Svedka Blue Raspberry | 6.25 | 6.25 | 6.25 | 0.0 | 0 | 0.0 | 25.36 | 0.246 | 4.1 |
| Midori | 5.5 | 5.5 | 5.5 | 0.0 | 0 | 0.0 | 25.36 | 0.217 | 4.6 |
| Grenadine | 3.5 | 3.5 | 3.5 | 0.0 | 0 | 0.0 | 33.814 | 0.104 | 9.7 |
| Orange bitters | 2.43 | 2.43 | 2.43 | 0.0 | 0 | 0.0 | 33.814 | 0.072 | 13.9 |

## Cocktails sold (decomposed)

| Cocktail | Sold | Inventory usage |
|----------|-----:|-------------------|
| Old Fashion | 27 | Woodford Reserve Shot 2.0oz×27=54.0oz, Simple Syrup 0.25oz×27=6.8oz, Orange bitters 0.09oz×27=2.4oz |
| Wizards Spellbook | 27 | Tito Shot 1.25oz×27=33.8oz |
| Strawberry Margarita | 20 | Patron Shot 1.25oz×20=25.0oz, Sour mix 1.5oz×20=30.0oz, Triple Sec 1.25oz×20=25.0oz, Strawberry Pucker 2.0oz×20=40.0oz |
| Cherrywood | 17 | Amaretto 1.25oz×17=21.2oz, Sour mix 1.25oz×17=21.2oz |
| Bigfoot | 15 | Knobb Creek Maple 1.25oz×15=18.8oz, Sour mix 1.25oz×15=18.8oz |
| Moscow Mule | 15 | Tito Shot 1.25oz×15=18.8oz |
| Dirty Shirley | 14 | Tito Shot 1.25oz×14=17.5oz, Grenadine 0.25oz×14=3.5oz |
| Slice Cream Float | 14 | Cruzan Vanilla 1.25oz×14=17.5oz |
| Enchanted Apple | 11 | Crown Royal Apple Shot 1.25oz×11=13.8oz, Sour mix 1.0oz×11=11.0oz, Midori 0.5oz×11=5.5oz, Simple Syrup 0.25oz×11=2.8oz |
| Blue Dot | 5 | Svedka Blue Raspberry 1.25oz×5=6.2oz |

## Standalone shots

| Clover shot | Inventory | Sold | oz/shot | Total oz |
|-------------|-----------|-----:|--------:|---------:|
| crown royal apple shot | Crown Royal Apple Shot | 9 | 1.5 | 13.5 |
| tito shot | Tito Shot | 9 | 1.5 | 13.5 |
| patron shot | Patron Shot | 8 | 1.5 | 12.0 |
| captain morgan shot | Captain Morgan Shot | 8 | 1.5 | 12.0 |
| jack daniel shot | Jack Daniel Shot | 6 | 1.5 | 9.0 |
| woodford reserve shot | Woodford Reserve Shot | 2 | 1.5 | 3.0 |

## Par hint

Multiply **avg bottles/wk** by how many weeks of stock you want on hand (e.g. 2 weeks → par ≈ 2 × avg bottles/wk, round up). WAT and LU may differ if sales skew by location — this report is combined.
