import { useCallback, useEffect, useMemo, useState } from "react";
import LocationInventoryTable from "./LocationInventoryTable";
import {
  parseTwoLocationRow,
  rowReadyForOrder,
  toOrderLine,
  type OnHandField,
  type TwoLocationCounts,
} from "./inventory-locations";
import LiquorOrderReviewPage from "./LiquorOrderReviewPage";
import { type CatalogItem, type LiquorLineInput } from "./liquor-utils";
import { useLiquorPar } from "./useLiquorPar";

type LiquorRow = {
  name: string;
  categoryName: string;
} & TwoLocationCounts;

type CatalogResponse = {
  ok: boolean;
  items: CatalogItem[];
  categories?: string[];
  count?: number;
  from_cache?: boolean;
  detail?: string;
};

const STORAGE_KEY = "wat-clover-liquor-inventory-v4";

type SavedOnHand = { name: string; watOnHand?: string; luOnHand?: string };

function loadSavedOnHand(): Map<string, SavedOnHand> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as SavedOnHand[];
    if (!Array.isArray(parsed)) return new Map();
    return new Map(parsed.map((r) => [r.name.toLowerCase(), r]));
  } catch {
    return new Map();
  }
}

export default function LiquorInventoryTab() {
  const [step, setStep] = useState<"entry" | "review">("entry");
  const [reviewLines, setReviewLines] = useState<LiquorLineInput[]>([]);
  const [rows, setRows] = useState<LiquorRow[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const { byName: liquorPar, error: parError } = useLiquorPar(step === "entry");

  useEffect(() => {
    if (catalogItems.length === 0) return;
    setRows((prev) => {
      const saved = loadSavedOnHand();
      return catalogItems.map((item) => {
        const key = item.name.toLowerCase();
        const p = liquorPar.get(key);
        const existing = prev.find((r) => r.name.toLowerCase() === key);
        const fromSave = saved.get(key);
        return {
          name: item.name,
          categoryName: item.category_name,
          watOnHand: existing?.watOnHand ?? fromSave?.watOnHand ?? "",
          luOnHand: existing?.luOnHand ?? fromSave?.luOnHand ?? "",
          watPar: p ? String(p.wat_par) : "0",
          luPar: p ? String(p.lu_par) : "0",
        };
      });
    });
  }, [catalogItems, liquorPar]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await fetch("/api/catalog");
      const text = await res.text();
      let data: CatalogResponse;
      try {
        data = JSON.parse(text) as CatalogResponse;
      } catch {
        throw new Error(`API ${res.status}: ${text.slice(0, 160)}`);
      }
      if (!res.ok) {
        throw new Error(data.detail || "Failed to load liquor catalog");
      }
      setCatalogItems(data.items ?? []);
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : "Failed to load catalog");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (rows.length > 0) {
      const payload = rows.map(({ name, watOnHand, luOnHand }) => ({
        name,
        watOnHand,
        luOnHand,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  }, [rows]);

  const updateRow = (name: string, field: OnHandField, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.name === name ? { ...r, [field]: value } : r)),
    );
  };

  const parsed = useMemo(
    () =>
      rows.map((r) => ({
        ...parseTwoLocationRow(r),
        name: r.name,
        categoryLabel: r.categoryName,
      })),
    [rows],
  );

  const unsetParCount = useMemo(
    () => parsed.filter((r) => r.watParNum === 0 || r.luParNum === 0).length,
    [parsed],
  );

  const allFilled = useMemo(
    () => parsed.length > 0 && parsed.every(rowReadyForOrder),
    [parsed],
  );

  const totalToOrder = useMemo(
    () => parsed.reduce((s, r) => s + (r.orderQty ?? 0), 0),
    [parsed],
  );

  const sendReady = allFilled && totalToOrder > 0;

  const goToReview = () => {
    if (!sendReady) return;
    const lines: LiquorLineInput[] = parsed
      .filter((r) => (r.orderQty ?? 0) > 0)
      .map((r) => toOrderLine(r.name, r));
    setReviewLines(lines);
    setStep("review");
  };

  if (step === "review") {
    return (
      <LiquorOrderReviewPage
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
    <section className="panel inventory-panel liquor-panel">
      <p className="inventory-intro">
        <strong>Shots</strong> and <strong>pour bottles</strong>. Enter <strong>WAT</strong> and{" "}
        <strong>LU</strong> on hand. <strong>Par</strong> is fixed (read-only from the database).
        Orders go to <strong>Provi</strong> — spirits by product ID, mixers in rep notes at checkout.
      </p>

      {parError && (
        <div className="error">{parError}</div>
      )}

      {unsetParCount > 0 && !parError && (
        <p className="inventory-hint">
          {unsetParCount} item(s) have no par set yet (shown as —) and cannot be ordered.
        </p>
      )}

      {catalogError && <div className="error">{catalogError}</div>}

      {catalogLoading && rows.length === 0 && (
        <div className="loading">Loading liquor inventory…</div>
      )}

      {!catalogLoading && rows.length === 0 && !catalogError && (
        <p className="inventory-hint">
          No liquor items found. Check Clover categories or set{" "}
          <code>CLOVER_LIQUOR_CATEGORIES</code> in .env.
        </p>
      )}

      {rows.length > 0 && (
        <LocationInventoryTable
          rows={parsed}
          nameHeader="Item"
          showCategory
          onUpdate={updateRow}
        />
      )}

      {allFilled && totalToOrder === 0 && rows.length > 0 && (
        <p className="inventory-hint">All items are at or above par — nothing to order.</p>
      )}

      <div className="inventory-footer">
        <div className="footer-summary">
          {rows.length === 0 && !catalogLoading ? (
            <span className="muted">No items to show.</span>
          ) : allFilled ? (
            <span>
              Total units below par (WAT + LU): <strong>{totalToOrder}</strong>
            </span>
          ) : (
            <span className="muted">Fill every WAT and LU on-hand field to continue.</span>
          )}
        </div>
        <button
          type="button"
          className={`btn btn-send ${sendReady ? "ready" : ""}`}
          disabled={!sendReady}
          onClick={goToReview}
        >
          Send liquor order to Provi?
        </button>
      </div>
    </section>
  );
}
