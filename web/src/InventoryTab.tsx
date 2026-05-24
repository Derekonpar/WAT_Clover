import { useEffect, useMemo, useState } from "react";
import {
  BEER_LINE_ITEMS,
  defaultParForBeer,
  distributorForBeer,
} from "./beer-line-items";
import type { InventoryLineInput } from "./order-utils";
import OrderReviewPage from "./OrderReviewPage";

type BeerRow = {
  name: string;
  onHand: string;
  par: string;
};

const STORAGE_KEY = "wat-clover-inventory-v4";

function initialRows(): BeerRow[] {
  return BEER_LINE_ITEMS.map((name) => ({
    name,
    onHand: "",
    par: String(defaultParForBeer(name)),
  }));
}

function loadSaved(): BeerRow[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BeerRow[];
    if (!Array.isArray(parsed)) return null;
    const names = new Set(BEER_LINE_ITEMS);
    const filtered = parsed.filter((r) => names.has(r.name as (typeof BEER_LINE_ITEMS)[number]));
    if (filtered.length !== BEER_LINE_ITEMS.length) return null;
    return BEER_LINE_ITEMS.map(
      (name) =>
        filtered.find((r) => r.name === name) ?? {
          name,
          onHand: "",
          par: String(defaultParForBeer(name)),
        },
    );
  } catch {
    return null;
  }
}

export default function InventoryTab() {
  const [step, setStep] = useState<"entry" | "review">("entry");
  const [reviewLines, setReviewLines] = useState<InventoryLineInput[]>([]);
  const [rows, setRows] = useState<BeerRow[]>(() => loadSaved() ?? initialRows());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }, [rows]);

  const updateRow = (name: string, field: "onHand" | "par", value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.name === name ? { ...r, [field]: value } : r)),
    );
  };

  const parsed = useMemo(() => {
    return rows.map((r) => {
      const onHand = r.onHand.trim() === "" ? null : Number(r.onHand);
      const par = r.par.trim() === "" ? null : Number(r.par);
      const orderQty =
        onHand != null && par != null && !Number.isNaN(onHand) && !Number.isNaN(par)
          ? Math.max(0, Math.round(par - onHand))
          : null;
      return { ...r, onHandNum: onHand, parNum: par, orderQty };
    });
  }, [rows]);

  const allFilled = useMemo(
    () =>
      parsed.every(
        (r) =>
          r.onHandNum != null &&
          !Number.isNaN(r.onHandNum) &&
          r.onHandNum >= 0 &&
          r.parNum != null &&
          !Number.isNaN(r.parNum) &&
          r.parNum >= 0,
      ),
    [parsed],
  );

  const totalToOrder = useMemo(
    () => parsed.reduce((s, r) => s + (r.orderQty ?? 0), 0),
    [parsed],
  );

  const sendReady = allFilled && totalToOrder > 0;

  const goToReview = () => {
    if (!sendReady) return;
    const lines: InventoryLineInput[] = parsed
      .filter((r) => (r.orderQty ?? 0) > 0)
      .map((r) => ({
        name: r.name,
        onHand: r.onHandNum!,
        par: r.parNum!,
        orderQty: r.orderQty!,
      }));
    setReviewLines(lines);
    setStep("review");
  };

  if (step === "review") {
    return (
      <OrderReviewPage
        lines={reviewLines}
        onBack={() => setStep("entry")}
        onSent={() => {
          setStep("entry");
          setReviewLines([]);
        }}
      />
    );
  }

  return (
    <section className="panel inventory-panel">
      <p className="inventory-intro">
        Enter <strong>on hand</strong> counts. <strong>Par</strong> is preset per beer (rounded to multiples of 24).
        Orders go to <strong>Bonbright</strong>, <strong>Heidelberg</strong>, or{" "}
        <strong>Yellow Springs</strong>.
      </p>

      <div className="table-wrap">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Beer</th>
              <th>Distributor</th>
              <th>On hand</th>
              <th>Par</th>
              <th className="col-order">Need</th>
            </tr>
          </thead>
          <tbody>
            {parsed.map((row) => {
              const dist = distributorForBeer(row.name);
              return (
                <tr key={row.name}>
                  <td className="beer-name">{row.name}</td>
                  <td className="dist-cell">{dist?.label ?? "—"}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      className="cell-input"
                      placeholder="—"
                      value={row.onHand}
                      onChange={(e) => updateRow(row.name, "onHand", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      className="cell-input"
                      value={row.par}
                      onChange={(e) => updateRow(row.name, "par", e.target.value)}
                    />
                  </td>
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
              );
            })}
          </tbody>
        </table>
      </div>

      {allFilled && totalToOrder === 0 && (
        <p className="inventory-hint">All items are at or above par — nothing to order.</p>
      )}

      <div className="inventory-footer">
        <div className="footer-summary">
          {allFilled ? (
            <span>
              Total units below par: <strong>{totalToOrder}</strong>
            </span>
          ) : (
            <span className="muted">Fill every on-hand and par field to continue.</span>
          )}
        </div>
        <button
          type="button"
          className={`btn btn-send ${sendReady ? "ready" : ""}`}
          disabled={!sendReady}
          onClick={goToReview}
        >
          Send orders?
        </button>
      </div>
    </section>
  );
}
