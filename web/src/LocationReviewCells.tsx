import { formatLocationPair } from "./inventory-locations";

type LocLine = {
  onHand: number;
  par: number;
  watOnHand?: number;
  luOnHand?: number;
  watPar?: number;
  luPar?: number;
};

export function LocationOnHandCell({ line }: { line?: LocLine }) {
  if (line?.watOnHand != null && line?.luOnHand != null) {
    return (
      <span className="loc-split">
        {formatLocationPair(line.watOnHand, line.luOnHand)}
      </span>
    );
  }
  return <>{line?.onHand ?? "—"}</>;
}

export function LocationParCell({ line }: { line?: LocLine }) {
  if (line?.watPar != null && line?.luPar != null) {
    return (
      <span className="loc-split">
        {formatLocationPair(line.watPar, line.luPar)}
      </span>
    );
  }
  return <>{line?.par ?? "—"}</>;
}
