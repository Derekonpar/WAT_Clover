import { useEffect, useMemo, useState } from "react";
import { LocationOnHandCell, LocationParCell } from "./LocationReviewCells";
import {
  formatCatalogSummary,
  type LiquorCatalogLine,
  type LiquorLineInput,
  type LiquorRepNotesLine,
} from "./liquor-utils";

type Props = {
  lines: LiquorLineInput[];
  onBack: () => void;
  onSent: () => void;
};

type ReviewResponse = {
  ok: boolean;
  mode?: string;
  channel?: string;
  message?: string;
  detail?: string;
  instructions?: string;
  catalog_lines?: LiquorCatalogLine[];
  rep_notes_lines?: LiquorRepNotesLine[];
  rep_notes_text?: string;
  provi?: {
    ok?: boolean;
    cart_id?: number;
    cart_total?: number;
    order_id?: number;
    added?: Array<{
      name: string;
      provi_product_id: string;
      inventory_id: number;
      units_needed: number;
      resolved_sku?: string;
      container_size?: string;
    }>;
    provi_cart_url?: string;
    errors?: string[];
  };
  provi_error?: string;
  provi_errors?: string[];
};

async function postLiquorOrders(lines: LiquorLineInput[], confirm: boolean) {
  const res = await fetch("/api/send-liquor-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines, confirm }),
  });
  const text = await res.text();
  let data: ReviewResponse;
  try {
    data = JSON.parse(text) as ReviewResponse;
  } catch {
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export default function LiquorOrderReviewPage({ lines, onBack, onSent }: Props) {
  const lineDetails = useMemo(
    () => new Map(lines.map((l) => [l.name, l])),
    [lines],
  );
  const [catalogLines, setCatalogLines] = useState<LiquorCatalogLine[]>([]);
  const [repNotesLines, setRepNotesLines] = useState<LiquorRepNotesLine[]>([]);
  const [repNotesText, setRepNotesText] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [proviBuilt, setProviBuilt] = useState<ReviewResponse["provi"] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await postLiquorOrders(lines, false);
        if (cancelled) return;
        setCatalogLines(data.catalog_lines ?? []);
        setRepNotesLines(data.rep_notes_lines ?? []);
        setRepNotesText(data.rep_notes_text ?? "");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load review");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lines]);

  const catalogSummary = useMemo(
    () => formatCatalogSummary(catalogLines),
    [catalogLines],
  );

  const handleCopy = async (label: string, text: string) => {
    try {
      await copyText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Could not copy to clipboard");
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await postLiquorOrders(lines, true);
      setProviBuilt(data.provi ?? null);
      const proviErr = data.provi_error || (data.provi_errors?.length ? data.provi_errors.join("; ") : null);
      if (proviErr && !data.provi?.ok) {
        setError(proviErr);
      }
      setSuccess(
        data.message ||
          "Provi cart updated — open Provi to review and Send when ready.",
      );
      setTimeout(onSent, 6000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finalize order");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <section className="panel review-panel">
      <button type="button" className="btn secondary back-btn" onClick={onBack}>
        ← Back to liquor inventory
      </button>

      <h2 className="review-title">Review liquor order for Provi</h2>
      <p className="review-intro">
        Spirits use <strong>Provi product IDs</strong> (exact SKU — e.g. 9232L, not 9232B).
        Mixers go in <strong>retailer notes</strong> at checkout. Building the cart calls Provi
        directly; you still click <strong>Send</strong> in Provi when ready.
      </p>

      {loading && <p className="muted">Loading Provi mapping…</p>}

      {catalogLines.length > 0 && (
        <div className="dist-order-block">
          <h3 className="review-subtitle">Catalog — add in Provi by product ID</h3>
          <table className="review-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Provi ID</th>
                <th>On hand (WAT / LU)</th>
                <th>Par (WAT / LU)</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {catalogLines.map((line) => (
                <tr key={line.name}>
                  <td>{line.name}</td>
                  <td>
                    <code>{line.provi_product_id}</code>
                  </td>
                  <td>
                    <LocationOnHandCell line={lineDetails.get(line.name)} />
                  </td>
                  <td>
                    <LocationParCell line={lineDetails.get(line.name)} />
                  </td>
                  <td>
                    <strong>{line.units_needed}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="copy-bar">
            <button
              type="button"
              className="btn secondary"
              disabled={!catalogSummary}
              onClick={() => handleCopy("catalog", catalogSummary)}
            >
              {copied === "catalog" ? "Copied!" : "Copy catalog list"}
            </button>
          </div>
        </div>
      )}

      {repNotesLines.length > 0 && (
        <div className="dist-order-block">
          <h3 className="review-subtitle">Rep notes — paste at Provi checkout</h3>
          <table className="review-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty needed</th>
              </tr>
            </thead>
            <tbody>
              {repNotesLines.map((line) => (
                <tr key={line.name}>
                  <td>{line.name}</td>
                  <td>
                    <strong>{line.units_needed}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <pre className="rep-notes-preview">{repNotesText}</pre>
          <div className="copy-bar">
            <button
              type="button"
              className="btn secondary"
              disabled={!repNotesText}
              onClick={() => handleCopy("notes", repNotesText)}
            >
              {copied === "notes" ? "Copied!" : "Copy rep notes"}
            </button>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
      {success && <div className="success-banner">{success}</div>}
      {proviBuilt?.added && proviBuilt.added.length > 0 && (
        <div className="dist-order-block">
          <h3 className="review-subtitle">Added to Provi cart</h3>
          <ul className="provi-added-list">
            {proviBuilt.added.map((a) => (
              <li key={`${a.inventory_id}-${a.provi_product_id}`}>
                {a.name}: {a.units_needed} × {a.resolved_sku ?? a.provi_product_id}
                {a.container_size ? ` (${a.container_size})` : ""}
              </li>
            ))}
          </ul>
          {proviBuilt.provi_cart_url && (
            <p className="muted">
              <a href={proviBuilt.provi_cart_url} target="_blank" rel="noreferrer">
                Open Provi cart
              </a>
              {proviBuilt.cart_total != null && (
                <> · draft total ${Number(proviBuilt.cart_total).toFixed(2)}</>
              )}
            </p>
          )}
        </div>
      )}

      <div className="inventory-footer">
        <button
          type="button"
          className="btn secondary"
          onClick={onBack}
          disabled={confirming}
        >
          Edit counts
        </button>
        <button
          type="button"
          className="btn btn-send ready"
          onClick={handleConfirm}
          disabled={
            confirming ||
            loading ||
            (catalogLines.length === 0 && repNotesLines.length === 0)
          }
        >
          {confirming ? "Building Provi cart…" : "Build cart in Provi"}
        </button>
      </div>
    </section>
  );
}
