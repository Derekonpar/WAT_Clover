import type { OnHandField, ParsedTwoLocationRow } from "./inventory-locations";

type Row = ParsedTwoLocationRow & { name: string; categoryLabel?: string };

type Props = {
  rows: Row[];
  nameHeader: string;
  showCategory?: boolean;
  inputsDisabled?: boolean;
  onUpdate: (name: string, field: OnHandField, value: string) => void;
};

function formatPar(value: string, num: number | null): string {
  if (num != null && num > 0) return String(num);
  const trimmed = value.trim();
  if (trimmed !== "" && Number(trimmed) === 0) return "—";
  return trimmed !== "" ? trimmed : "—";
}

export default function LocationInventoryTable({
  rows,
  nameHeader,
  showCategory,
  inputsDisabled = false,
  onUpdate,
}: Props) {
  return (
    <div className="table-wrap">
      <table className="inventory-table inventory-table-locations">
        <thead>
          <tr>
            <th rowSpan={2}>{nameHeader}</th>
            {showCategory && <th rowSpan={2}>Category</th>}
            <th colSpan={2} className="loc-group">
              On hand
            </th>
            <th colSpan={2} className="loc-group">
              Par
            </th>
            <th rowSpan={2} className="col-order">
              Need
            </th>
          </tr>
          <tr className="loc-subhead">
            <th>WAT</th>
            <th>LU</th>
            <th>WAT</th>
            <th>LU</th>
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
                  value={row.watOnHand}
                  disabled={inputsDisabled}
                  onChange={(e) => onUpdate(row.name, "watOnHand", e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  className="cell-input cell-input-narrow"
                  placeholder="—"
                  value={row.luOnHand}
                  disabled={inputsDisabled}
                  onChange={(e) => onUpdate(row.name, "luOnHand", e.target.value)}
                />
              </td>
              <td className="par-readonly">{formatPar(row.watPar, row.watParNum)}</td>
              <td className="par-readonly">{formatPar(row.luPar, row.luParNum)}</td>
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
