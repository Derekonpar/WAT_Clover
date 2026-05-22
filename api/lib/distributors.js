/** Distributor routing — beers per supplier */
import { BEER_LINE_ITEMS, canonicalBeerName } from "./beer-line-items.js";

export const DISTRIBUTORS = [
  {
    id: "bonbright",
    label: "Bonbright",
    emailEnv: "BONBRIGHT_ORDER_EMAIL",
    emailFallback: "avogt@bonbright.com",
    beers: ["Miller Lite", "Guinness", "Blue Moon", "Coors Light", "Modelo"],
  },
  {
    id: "heidelberg",
    label: "Heidelberg",
    emailEnv: "HEIDELBERG_ORDER_EMAIL",
    emailFallback: "wes.feldmeyer@heidelbergdistributing.com",
    beers: [
      "Michelob Ultra",
      "Yuengling",
      "Bud Light",
      "Angry Orchard",
      "High Noon Pineapple",
      "Busch Light",
      "Truth",
    ],
  },
  {
    id: "yellow_springs",
    label: "Yellow Springs",
    emailEnv: "YELLOW_SPRINGS_ORDER_EMAIL",
    emailFallback: "shawn@yellowspringsbrewery.com",
    beers: ["Boat Show (Yellow Springs)"],
  },
];

export function distributorForBeer(beerName) {
  const canonical = canonicalBeerName(beerName) || beerName;
  const lower = canonical.trim().toLowerCase();
  for (const d of DISTRIBUTORS) {
    if (d.beers.some((b) => b.toLowerCase() === lower)) return d;
  }
  return null;
}

export function unassignedBeers() {
  const assigned = new Set(
    DISTRIBUTORS.flatMap((d) => d.beers.map((b) => b.toLowerCase())),
  );
  return BEER_LINE_ITEMS.filter((b) => !assigned.has(b.toLowerCase()));
}

export function resolveEmail(dist) {
  const fromEnv = (process.env[dist.emailEnv] || "").trim();
  return fromEnv || dist.emailFallback;
}
