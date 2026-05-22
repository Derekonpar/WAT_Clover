import { useEffect, useState } from "react";
import {
  buildDistributorOrdersFromLines,
  formatEmailBody,
  type DistributorOrder,
  type InventoryLineInput,
  type PackLine,
} from "./order-utils";

type Props = {
  lines: InventoryLineInput[];
  onBack: () => void;
  onSent: () => void;
};

type ApiPackLine = {
  name: string;
  onHand?: number;
  par?: number;
  unitsNeeded?: number;
  packSize?: number;
  packs?: number;
  unitsOrdered?: number;
};

type ApiDistributor = {
  distributorId: string;
  distributor: string;
  to: string;
  lines: ApiPackLine[];
};

type SendResponse = {
  ok: boolean;
  mode?: string;
  from?: string;
  message?: string;
  detail?: string;
  distributors?: ApiDistributor[];
  sent?: Array<{ distributor: string; to: string }>;
};

function mapApiDistributors(api: ApiDistributor[]): DistributorOrder[] {
  return api.map((d) => ({
    distributorId: d.distributorId as DistributorOrder["distributorId"],
    distributor: d.distributor,
    to: d.to,
    lines: d.lines.map(
      (l): PackLine => ({
        name: l.name,
        onHand: Number(l.onHand ?? 0),
        par: Number(l.par ?? 0),
        unitsNeeded: Number(l.unitsNeeded ?? 0),
        packSize: Number(l.packSize ?? 12),
        packs: Number(l.packs ?? 0),
        unitsOrdered: Number(l.unitsOrdered ?? 0),
      }),
    ),
  }));
}

async function postSendOrders(
  lines: InventoryLineInput[],
  confirm: boolean,
): Promise<SendResponse> {
  const res = await fetch("/api/send-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines, confirm }),
  });
  const text = await res.text();
  let data: SendResponse;
  try {
    data = JSON.parse(text) as SendResponse;
  } catch {
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(data.detail || "Request failed");
  }
  return data;
}

export default function OrderReviewPage({ lines, onBack, onSent }: Props) {
  const fallback = buildDistributorOrdersFromLines(lines);
  const [distributors, setDistributors] = useState<DistributorOrder[]>(fallback);
  const [fromEmail, setFromEmail] = useState<string | null>(null);
  const [loadingReview, setLoadingReview] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Array<{ distributor: string; to: string }>>(
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingReview(true);
      setError(null);
      try {
        const data = await postSendOrders(lines, false);
        if (cancelled) return;
        if (data.distributors?.length) {
          setDistributors(mapApiDistributors(data.distributors));
        }
        if (data.from) setFromEmail(data.from);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? `${e.message} (showing local preview; confirm may still work if API is up)`
              : "Could not load review from server",
          );
          setDistributors(fallback);
        }
      } finally {
        if (!cancelled) setLoadingReview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lines identity is stable for this step
  }, [lines]);

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    setSuccess(null);
    setSentTo([]);
    try {
      const data = await postSendOrders(lines, true);
      if (data.from) setFromEmail(data.from);
      setSentTo(data.sent ?? []);
      setSuccess(
        data.message ||
          `Sent ${data.sent?.length ?? 0} order email(s) to distributors.`,
      );
      setTimeout(onSent, 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <section className="panel review-panel">
      <button type="button" className="btn secondary back-btn" onClick={onBack}>
        ← Back to inventory
      </button>

      <h2 className="review-title">Review orders by distributor</h2>
      <p className="review-intro">
        Quantities are rounded up to full cases (Bonbright: 12-pack, Coors 8-pack ·
        Heidelberg: 24-pack · Yellow Springs: 12-pack). When you confirm, one email
        per distributor is sent from your configured Gmail account.
      </p>

      {fromEmail && (
        <p className="send-from-banner">
          Sending from: <strong>{fromEmail}</strong>
        </p>
      )}

      {loadingReview && <p className="muted">Loading order preview…</p>}

      {distributors.map((d) => (
        <DistributorBlock key={d.distributorId} order={d} />
      ))}

      {error && <div className="error">{error}</div>}
      {success && (
        <div className="success-banner">
          <p>{success}</p>
          {sentTo.length > 0 && (
            <ul className="sent-list">
              {sentTo.map((s) => (
                <li key={s.distributor}>
                  <strong>{s.distributor}</strong> → {s.to}
                </li>
              ))}
            </ul>
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
          disabled={confirming || loadingReview || distributors.length === 0}
        >
          {confirming ? "Sending emails…" : "Confirm send orders"}
        </button>
      </div>
    </section>
  );
}

function DistributorBlock({ order }: { order: DistributorOrder }) {
  const body = formatEmailBody(order.distributor, order.lines);

  return (
    <div className="dist-order-block">
      <h3>{order.distributor}</h3>
      <p className="dist-email-to">
        Email to: <a href={`mailto:${order.to}`}>{order.to}</a>
      </p>
      <table className="review-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>On hand</th>
            <th>Par</th>
            <th>Need</th>
            <th>Pack</th>
            <th>Order</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => (
            <tr key={line.name}>
              <td>{line.name}</td>
              <td>{line.onHand}</td>
              <td>{line.par}</td>
              <td>{line.unitsNeeded}</td>
              <td>{line.packSize}</td>
              <td className="order-cell">
                <strong>
                  {line.packs} case{line.packs === 1 ? "" : "s"}
                </strong>
                <span className="sub"> ({line.unitsOrdered} units)</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <details className="email-preview">
        <summary>Email preview</summary>
        <pre>{body}</pre>
      </details>
    </div>
  );
}
