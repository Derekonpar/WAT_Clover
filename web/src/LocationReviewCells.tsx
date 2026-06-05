import { formatLocationPair } from "./inventory-locations";

type LocLine = {
  onHand: number;
  par: number;
  watOnHand?: number;
  luOnHand?: number;
  watPar?: number;
  luPar?: number;
  backupOnHand?: number;
  backupPar?: number;
};

export function LocationOnHandCell({ line }: { line?: LocLine }) {
  if (line?.watOnHand != null && line?.luOnHand != null) {
    const parts = [formatLocationPair(line.watOnHand, line.luOnHand)];
    if (line.backupOnHand != null) {
      parts.push(`Back ${line.backupOnHand}`);
    }
    return <span className="loc-split">{parts.join(" · ")}</span>;
  }
  return <>{line?.onHand ?? "—"}</>;
}

export function LocationParCell({ line }: { line?: LocLine }) {
  if (line?.watPar != null && line?.luPar != null) {
    const parts = [formatLocationPair(line.watPar, line.luPar)];
    if (line.backupPar != null) {
      parts.push(`Back ${line.backupPar}`);
    }
    return <span className="loc-split">{parts.join(" · ")}</span>;
  }
  return <>{line?.par ?? "—"}</>;
}
