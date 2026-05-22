import { useCallback, useEffect, useState } from "react";

type Tab = "sales" | "inventory";

type LineItem = {
  name: string;
  category: string;
  category_name: string;
  quantity_sold: number;
  gross_minor_units: number;
  line_count: number;
};

type SalesReport = {
  clover_category: string;
  time_range: { start_date: string; end_date: string };
  beer_sku_count?: number;
  from_cache?: boolean;
  totals: {
    quantity_sold: number;
    gross_minor_units: number;
    unique_items: number;
  };
  items: LineItem[];
};

function formatMoney(minor: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(minor / 100);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function lastWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - diffToMonday);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);
  return { start: isoDate(lastMonday), end: isoDate(lastSunday) };
}

function last7DaysRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  return { start: isoDate(start), end: isoDate(end) };
}

export default function App() {
  const initial = lastWeekRange();
  const [tab, setTab] = useState<Tab>("sales");
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SalesReport | null>(null);

  const load = useCallback(
    async (opts?: { refresh?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({
          start_date: startDate,
          end_date: endDate,
        });
        if (opts?.refresh) qs.set("refresh", "true");
        const res = await fetch(`/api/sales?${qs}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Failed to load sales data");
        }
        setReport(data);
      } catch (e) {
        setReport(null);
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate],
  );

  // Load once when opening Sales; changing dates requires Apply (uses server cache).
  useEffect(() => {
    if (tab === "sales" && !report && !loading) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const rows = report?.items ?? [];

  return (
    <div className="app">
      <header className="header">
        <h1>Wild Axe — Beer Sales</h1>
        <p>13 Clover Beer items · qty and revenue for your date range</p>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${tab === "sales" ? "active" : ""}`}
          onClick={() => setTab("sales")}
        >
          Sales
        </button>
        <button
          className={`tab ${tab === "inventory" ? "active" : ""}`}
          onClick={() => setTab("inventory")}
        >
          Inventory
        </button>
      </nav>

      {tab === "sales" && (
        <section className="panel">
          <div className="date-bar">
            <div className="field">
              <label htmlFor="start">Start date</label>
              <input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="end">End date</label>
              <input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <button className="btn" onClick={() => load()} disabled={loading}>
              {loading ? "Loading…" : "Apply"}
            </button>
            <button
              className="btn secondary"
              disabled={loading}
              onClick={() => load({ refresh: true })}
              title="Bypass cache and call Clover again"
            >
              Refresh from Clover
            </button>
            <button
              className="btn secondary"
              disabled={loading}
              onClick={() => {
                const r = lastWeekRange();
                setStartDate(r.start);
                setEndDate(r.end);
              }}
            >
              Last week
            </button>
            <button
              className="btn secondary"
              disabled={loading}
              onClick={() => {
                const r = last7DaysRange();
                setStartDate(r.start);
                setEndDate(r.end);
              }}
            >
              Last 7 days
            </button>
          </div>

          {error && <div className="error">{error}</div>}

          {loading && !report && <div className="loading">Fetching beer sales from Clover…</div>}

          {report && (
            <>
              <div className="stats">
                <div className="stat">
                  <div className="label">Beer items</div>
                  <div className="value">{report.beer_sku_count ?? rows.length}</div>
                </div>
                <div className="stat">
                  <div className="label">Units sold</div>
                  <div className="value">{report.totals.quantity_sold}</div>
                </div>
                <div className="stat">
                  <div className="label">Beer revenue</div>
                  <div className="value money">
                    {formatMoney(report.totals.gross_minor_units)}
                  </div>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Gross</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={4}>No beer sales in this date range.</td>
                      </tr>
                    ) : (
                      rows.map((row, index) => (
                        <tr
                          key={row.name}
                          className={row.quantity_sold === 0 ? "row-zero" : undefined}
                        >
                          <td>{index + 1}</td>
                          <td>{row.name}</td>
                          <td>{row.quantity_sold}</td>
                          <td className="money">
                            {row.quantity_sold === 0
                              ? "—"
                              : formatMoney(row.gross_minor_units)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "1rem" }}>
                Clover category: {report.clover_category} · {report.time_range.start_date} →{" "}
                {report.time_range.end_date}
                {report.from_cache ? " · served from cache (no Clover calls)" : " · fresh from Clover"}
              </p>
            </>
          )}
        </section>
      )}

      {tab === "inventory" && (
        <section className="panel placeholder">
          <h3>Inventory (coming next)</h3>
          <p>
            This tab will load par levels from your Google Sheet and compare against
            current stock. On Mondays, Twilio will text reorder suggestions based on
            how far items are off par.
          </p>
          <p>
            <strong>Next step for you:</strong> share the Google Sheets link and we will
            wire it in here.
          </p>
        </section>
      )}
    </div>
  );
}
