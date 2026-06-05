import type { ParsedSingleLocationRow } from "./inventory-locations";

type Row = ParsedSingleLocationRow & { name: string; categoryLabel?: string };

type Props = {
  rows: Row[];
  nameHeader: string;
  showCategory?: boolean;
  onUpdate: (name: string, value: string) => void;
};

function formatPar(num: number | null): string {
  if (num != null && num > 0) return String(num);
  return "—";
}

export default function BackupInventoryTable({
  rows,
  nameHeader,
  showCategory,
  onUpdate,
}: Props) {
  return (
    <div className="table-wrap">
      <table className="inventory-table inventory-table-backup">
        <thead>
          <tr>
            <th>{nameHeader}</th>
            {showCategory && <th>Category</th>}
            <th>On hand</th>
            <th>Par</th>
            <th className="col-order">Need</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td className="beer-name">{row.name}</td>
              {showCategory && (
                <td className="dist-cell">{row.categoryLabel || "—"}</td>
              )}
              <td>
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  className="cell-input cell-input-narrow"
                  placeholder="—"
                  value={row.onHand}
                  onChange={(e) => onUpdate(row.name, e.target.value)}
                />
              </td>
              <td className="par-readonly">{formatPar(row.parNum)}</td>
              <td className="col-order">
                {row.orderQty != null ? (
                  <span
                    className={
                      row.orderQty > 0 ? "order-qty needs-order" : "order-qty at-par"
                    }
                  >
                    {row.orderQty > 0 ? row.orderQty : "0"}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
