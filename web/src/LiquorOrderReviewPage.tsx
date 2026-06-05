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
    mode?: string;
    cart_id?: number;
    cart_total?: number;
    order_id?: number;
    submitted_at?: string | null;
    rep_notes?: string;
    location?: { ohlq_account_number?: string; retailer_id?: number };
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

async function postLiquorOrders(lines: LiquorLineInput[], confirm: boolean, submit: boolean) {
  const res = await fetch("/api/send-liquor-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines, confirm, submit }),
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
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [proviResult, setProviResult] = useState<ReviewResponse["provi"] | null>(null);
  const [orderSent, setOrderSent] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await postLiquorOrders(lines, false, false);
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

  const handleSendOrder = async () => {
    if (orderSent) return;
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await postLiquorOrders(lines, true, true);
      setProviResult(data.provi ?? null);
      const proviErr =
        data.provi_error ||
        (data.provi_errors?.length ? data.provi_errors.join("; ") : null);
      if (proviErr && !data.provi?.ok) {
        setError(proviErr);
        return;
      }
      setOrderSent(true);
      setSuccess(
        data.message || "Order sent to Provi — your rep will receive the request.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send order to Provi");
    } finally {
      setSending(false);
    }
  };

  const handleDone = () => {
    onSent();
  };

  return (
    <section className="panel review-panel">
      <button type="button" className="btn secondary back-btn" onClick={onBack}>
        ← Back to liquor inventory
      </button>

      <h2 className="review-title">Review liquor order for Provi</h2>
      <p className="review-intro">
        {orderSent ? (
          <>
            Order submitted to <strong>Wild Axe</strong> on Provi. Your rep will receive the
            request — tap <strong>Done</strong> when finished.
          </>
        ) : (
          <>
            Spirits use <strong>Provi product IDs</strong> (exact SKU — e.g. 9232L, not 9232B).
            Mixers go in <strong>retailer notes</strong>. Click <strong>Send order to Provi</strong>{" "}
            to build the cart and submit automatically.
          </>
        )}
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
          {!orderSent && (
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
          )}
        </div>
      )}

      {repNotesLines.length > 0 && (
        <div className="dist-order-block">
          <h3 className="review-subtitle">Rep notes — included at checkout</h3>
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
          {!orderSent && (
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
          )}
        </div>
      )}

      {error && <div className="error">{error}</div>}
      {success && <div className="success-banner">{success}</div>}
      {orderSent && proviResult && (
        <div className="dist-order-block provi-cart-ready-block">
          <h3 className="review-subtitle">Order sent</h3>
          {proviResult.added && proviResult.added.length > 0 && (
            <ul className="provi-added-list">
              {proviResult.added.map((a) => (
                <li key={`${a.inventory_id}-${a.provi_product_id}`}>
                  {a.name}: {a.units_needed} × {a.resolved_sku ?? a.provi_product_id}
                  {a.container_size ? ` (${a.container_size})` : ""}
                </li>
              ))}
            </ul>
          )}
          {proviResult.rep_notes && (
            <p className="muted provi-rep-notes-line">
              Rep notes: <em>{proviResult.rep_notes}</em>
            </p>
          )}
          {proviResult.cart_total != null && (
            <p className="muted">
              Order total: <strong>${Number(proviResult.cart_total).toFixed(2)}</strong>
            </p>
          )}
          {proviResult.submitted_at && (
            <p className="muted">
              Submitted: <strong>{new Date(proviResult.submitted_at).toLocaleString()}</strong>
            </p>
          )}
          {proviResult.location?.ohlq_account_number && (
            <p className="muted">
              OHLQ account: <strong>{proviResult.location.ohlq_account_number}</strong>
            </p>
          )}
        </div>
      )}

      <div className="inventory-footer">
        {!orderSent ? (
          <>
            <button
              type="button"
              className="btn secondary"
              onClick={onBack}
              disabled={sending}
            >
              Edit counts
            </button>
            <button
              type="button"
              className="btn btn-send ready"
              onClick={handleSendOrder}
              disabled={
                sending ||
                loading ||
                (catalogLines.length === 0 && repNotesLines.length === 0)
              }
            >
              {sending ? "Sending to Provi…" : "Send order to Provi"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn secondary" onClick={onBack}>
              Edit counts
            </button>
            <button type="button" className="btn btn-send ready" onClick={handleDone}>
              Done
            </button>
          </>
        )}
      </div>
    </section>
  );
}
