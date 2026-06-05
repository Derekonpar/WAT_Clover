import { useEffect, useMemo, useState } from "react";
import {
  formatSunSatWeekLabel,
  isParReadyForOrderWeek,
  lastCompleteSunSatWeek,
  markParReadyForOrderWeek,
} from "./beer-week";
import {
  BEER_LINE_ITEMS,
  defaultParForBeer,
  distributorForBeer,
} from "./beer-line-items";
import LocationInventoryTable from "./LocationInventoryTable";
import {
  parseTwoLocationRow,
  rowReadyForOrder,
  toOrderLine,
  type OnHandField,
  type TwoLocationCounts,
} from "./inventory-locations";
import type { InventoryLineInput } from "./order-utils";
import OrderReviewPage from "./OrderReviewPage";
import { useBeerPar } from "./useBeerPar";

type BeerRow = { name: string } & TwoLocationCounts;

const STORAGE_KEY = "wat-clover-inventory-v7";

type SavedOnHand = { name: string; watOnHand?: string; luOnHand?: string };

function loadSavedOnHand(): Map<string, SavedOnHand> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as SavedOnHand[];
    if (!Array.isArray(parsed)) return new Map();
    return new Map(parsed.map((r) => [r.name, r]));
  } catch {
    return new Map();
  }
}

export default function InventoryTab() {
  const [step, setStep] = useState<"entry" | "review">("entry");
  const [reviewLines, setReviewLines] = useState<InventoryLineInput[]>([]);
  const orderWeek = useMemo(() => lastCompleteSunSatWeek(), []);
  const [parReady, setParReady] = useState(() =>
    isParReadyForOrderWeek(orderWeek.end),
  );
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<BeerRow[]>(() => {
    const saved = loadSavedOnHand();
    return BEER_LINE_ITEMS.map((name) => {
      const prev = saved.get(name);
      const par = String(defaultParForBeer(name));
      return {
        name,
        watOnHand: prev?.watOnHand ?? "",
        luOnHand: prev?.luOnHand ?? "",
        watPar: par,
        luPar: par,
      };
    });
  });
  const {
    byName: beerPar,
    loading: parLoading,
    updating: parUpdating,
    error: parError,
    updateForOrders,
  } = useBeerPar(step === "entry");

  useEffect(() => {
    setParReady(isParReadyForOrderWeek(orderWeek.end));
  }, [orderWeek.end]);

  useEffect(() => {
    if (beerPar.size === 0) return;
    setRows((prev) =>
      BEER_LINE_ITEMS.map((name) => {
        const s = beerPar.get(name.toLowerCase());
        const existing = prev.find((r) => r.name === name);
        const fallbackPar = String(defaultParForBeer(name));
        return {
          name,
          watOnHand: existing?.watOnHand ?? "",
          luOnHand: existing?.luOnHand ?? "",
          watPar: s ? String(s.wat_par) : fallbackPar,
          luPar: s ? String(s.lu_par) : fallbackPar,
        };
      }),
    );
  }, [beerPar]);

  useEffect(() => {
    const payload = rows.map(({ name, watOnHand, luOnHand }) => ({
      name,
      watOnHand,
      luOnHand,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [rows]);

  const handleUpdatePar = async () => {
    setUpdateMessage(null);
    const data = await updateForOrders();
    if (data?.order_week?.end) {
      markParReadyForOrderWeek(data.order_week.end);
      setParReady(true);
      const label =
        data.order_week.label ??
        formatSunSatWeekLabel(data.order_week.start, data.order_week.end);
      setUpdateMessage(
        data.mode === "bootstrap"
          ? `Loaded ${data.sync?.weeks_synced?.length ?? 8} weeks of history and updated par for ${label}.`
          : `Synced sales for ${label} and updated par from the 6-week average.`,
      );
    }
  };

  const updateRow = (name: string, field: OnHandField, value: string) => {
    if (!parReady) return;
    setRows((prev) =>
      prev.map((r) => (r.name === name ? { ...r, [field]: value } : r)),
    );
  };

  const parsed = useMemo(
    () =>
      rows.map((r) => {
        const p = parseTwoLocationRow(r);
        const dist = distributorForBeer(r.name);
        return { ...p, name: r.name, categoryLabel: dist?.label };
      }),
    [rows],
  );

  const allFilled = useMemo(
    () => parReady && parsed.length > 0 && parsed.every(rowReadyForOrder),
    [parsed, parReady],
  );

  const totalToOrder = useMemo(
    () => parsed.reduce((s, r) => s + (r.orderQty ?? 0), 0),
    [parsed],
  );

  const sendReady = allFilled && totalToOrder > 0;
  const weekLabel = formatSunSatWeekLabel(orderWeek.start, orderWeek.end);

  const goToReview = () => {
    if (!sendReady) return;
    const lines: InventoryLineInput[] = parsed
      .filter((r) => (r.orderQty ?? 0) > 0)
      .map((r) => toOrderLine(r.name, r));
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
        Orders go out on <strong>Sunday</strong>. Weeks run <strong>Sunday–Saturday</strong>.
        Par is half the trailing <strong>6-week average</strong> per cooler (sales are combined in
        Clover), rounded to each beer&apos;s case pack size, plus an <strong>aesthetic buffer</strong>{" "}
        per location. Click{" "}
        <strong>Update par for this week&apos;s orders</strong> first — it syncs the last complete
        week to Supabase and refreshes par. Then enter on-hand for WAT and LU.
      </p>

      <div className="catalog-toolbar beer-par-update-bar">
        <button
          type="button"
          className={`btn ${parReady ? "secondary" : "ready"}`}
          disabled={parLoading || parUpdating}
          onClick={handleUpdatePar}
        >
          {parUpdating
            ? "Syncing sales & updating par…"
            : parLoading
              ? "Loading…"
              : "Update par for this week's orders"}
        </button>
        <p className="muted beer-par-week-label">
          Last complete week: <strong>{weekLabel}</strong>
          {parReady ? " · par ready for inventory" : " · update required before entering counts"}
        </p>
      </div>

      {parError && (
        <div className="error">{parError}</div>
      )}
      {updateMessage && <div className="success-banner">{updateMessage}</div>}

      {!parReady && !parLoading && (
        <p className="inventory-hint">
          Run <strong>Update par for this week&apos;s orders</strong> above before entering on-hand
          counts. Do this after each Saturday (or Saturday night) so Sunday orders use fresh par.
        </p>
      )}

      <LocationInventoryTable
        rows={parsed}
        nameHeader="Beer"
        showCategory
        inputsDisabled={!parReady}
        onUpdate={updateRow}
      />

      {parReady && allFilled && totalToOrder === 0 && (
        <p className="inventory-hint">All items are at or above par — nothing to order.</p>
      )}

      <div className="inventory-footer">
        <div className="footer-summary">
          {!parReady ? (
            <span className="muted">Update par for this week before entering inventory.</span>
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
          Send orders?
        </button>
      </div>
    </section>
  );
}
