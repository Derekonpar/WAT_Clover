import { useCallback, useEffect, useMemo, useState } from "react";
import BackupInventoryTable from "./BackupInventoryTable";
import LocationInventoryTable from "./LocationInventoryTable";
import {
  parseSingleLocationRow,
  parseTwoLocationRow,
  rowReadyForBackupOrder,
  rowReadyForOrder,
  type OnHandField,
  type TwoLocationCounts,
} from "./inventory-locations";
import LiquorOrderReviewPage from "./LiquorOrderReviewPage";
import {
  liquorBackupParForItem,
  liquorFrontParForItem,
  type CatalogItem,
  type LiquorLineInput,
} from "./liquor-utils";

type LiquorRow = {
  name: string;
  categoryName: string;
} & TwoLocationCounts;

type BackupRow = {
  name: string;
  categoryName: string;
  onHand: string;
  par: string;
};

type CatalogResponse = {
  ok: boolean;
  items: CatalogItem[];
  categories?: string[];
  count?: number;
  from_cache?: boolean;
  detail?: string;
};

const STORAGE_KEY = "wat-clover-liquor-inventory-v5";

type SavedOnHand = {
  name: string;
  watOnHand?: string;
  luOnHand?: string;
  backupOnHand?: string;
};

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

function frontParStrings(name: string): { watPar: string; luPar: string } {
  const p = String(liquorFrontParForItem(name));
  return { watPar: p, luPar: p };
}

export default function LiquorInventoryTab() {
  const [step, setStep] = useState<"entry" | "review">("entry");
  const [reviewLines, setReviewLines] = useState<LiquorLineInput[]>([]);
  const [rows, setRows] = useState<LiquorRow[]>([]);
  const [backupRows, setBackupRows] = useState<BackupRow[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  useEffect(() => {
    if (catalogItems.length === 0) return;
    const saved = loadSavedOnHand();
    setRows((prev) =>
      catalogItems.map((item) => {
        const key = item.name.toLowerCase();
        const existing = prev.find((r) => r.name.toLowerCase() === key);
        const fromSave = saved.get(key);
        const { watPar, luPar } = frontParStrings(item.name);
        return {
          name: item.name,
          categoryName: item.category_name,
          watOnHand: existing?.watOnHand ?? fromSave?.watOnHand ?? "",
          luOnHand: existing?.luOnHand ?? fromSave?.luOnHand ?? "",
          watPar,
          luPar,
        };
      }),
    );
    setBackupRows((prev) =>
      catalogItems.map((item) => {
        const key = item.name.toLowerCase();
        const existing = prev.find((r) => r.name.toLowerCase() === key);
        const fromSave = saved.get(key);
        return {
          name: item.name,
          categoryName: item.category_name,
          onHand: existing?.onHand ?? fromSave?.backupOnHand ?? "",
          par: String(liquorBackupParForItem(item.name)),
        };
      }),
    );
  }, [catalogItems]);

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
    if (rows.length === 0) return;
    const backupByName = new Map(backupRows.map((r) => [r.name.toLowerCase(), r]));
    const payload = rows.map(({ name, watOnHand, luOnHand }) => ({
      name,
      watOnHand,
      luOnHand,
      backupOnHand: backupByName.get(name.toLowerCase())?.onHand ?? "",
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [rows, backupRows]);

  const updateRow = (name: string, field: OnHandField, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.name === name ? { ...r, [field]: value } : r)),
    );
  };

  const updateBackupRow = (name: string, value: string) => {
    setBackupRows((prev) =>
      prev.map((r) => (r.name === name ? { ...r, onHand: value } : r)),
    );
  };

  const parsedFront = useMemo(
    () =>
      rows.map((r) => ({
        ...parseTwoLocationRow(r),
        name: r.name,
        categoryLabel: r.categoryName,
      })),
    [rows],
  );

  const parsedBackup = useMemo(
    () =>
      backupRows.map((r) => ({
        ...parseSingleLocationRow(r),
        name: r.name,
        categoryLabel: r.categoryName,
      })),
    [backupRows],
  );

  const combinedByName = useMemo(() => {
    const backupMap = new Map(parsedBackup.map((r) => [r.name.toLowerCase(), r]));
    return parsedFront.map((front) => {
      const backup = backupMap.get(front.name.toLowerCase());
      const frontNeed = front.orderQty ?? 0;
      const backupNeed = backup?.orderQty ?? 0;
      const backupPar = backup?.parNum ?? liquorBackupParForItem(front.name);
      const backupOnHand = backup?.onHandNum ?? 0;
      return {
        name: front.name,
        categoryLabel: front.categoryLabel,
        front,
        backup,
        totalNeed: frontNeed + backupNeed,
        line:
          front.watOnHandNum != null &&
          front.luOnHandNum != null &&
          front.watParNum != null &&
          front.luParNum != null &&
          backup?.onHandNum != null &&
          backup.parNum != null
            ? {
                name: front.name,
                watOnHand: front.watOnHandNum,
                luOnHand: front.luOnHandNum,
                watPar: front.watParNum,
                luPar: front.luParNum,
                backupOnHand,
                backupPar,
                onHand: front.watOnHandNum + front.luOnHandNum + backupOnHand,
                par: front.watParNum + front.luParNum + backupPar,
                orderQty: frontNeed + backupNeed,
              }
            : null,
      };
    });
  }, [parsedFront, parsedBackup]);

  const allFilled = useMemo(
    () =>
      combinedByName.length > 0 &&
      combinedByName.every(
        (c) =>
          rowReadyForOrder(c.front) &&
          c.backup != null &&
          rowReadyForBackupOrder(c.backup),
      ),
    [combinedByName],
  );

  const totalToOrder = useMemo(
    () => combinedByName.reduce((s, c) => s + c.totalNeed, 0),
    [combinedByName],
  );

  const sendReady = allFilled && totalToOrder > 0;

  const goToReview = () => {
    if (!sendReady) return;
    const lines: LiquorLineInput[] = combinedByName
      .filter((c) => c.totalNeed > 0 && c.line)
      .map((c) => c.line!);
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
        <strong>Front coolers</strong> — enter <strong>WAT</strong> and <strong>LU</strong> counts
        (par <strong>4</strong> each, <strong>Midori 3</strong>). <strong>Backup</strong> stock is
        one count per item (par <strong>4</strong>). Order need combines both sections. Sends to{" "}
        <strong>Provi</strong>.
      </p>

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
        <>
          <h3 className="inventory-section-title">Front coolers (WAT / LU)</h3>
          <LocationInventoryTable
            rows={parsedFront}
            nameHeader="Item"
            showCategory
            onUpdate={updateRow}
          />

          <h3 className="inventory-section-title">Backup stock</h3>
          <BackupInventoryTable
            rows={parsedBackup}
            nameHeader="Item"
            showCategory
            onUpdate={updateBackupRow}
          />
        </>
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
              Total units below par (front + backup): <strong>{totalToOrder}</strong>
            </span>
          ) : (
            <span className="muted">
              Fill every WAT, LU, and backup on-hand field to continue.
            </span>
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
