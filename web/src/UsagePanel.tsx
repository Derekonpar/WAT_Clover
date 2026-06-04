import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMoney, last7DaysRange, lastWeekRange } from "./date-utils";
import { filterUsageAllView } from "./usage-all-filter";

export type UsageLineItem = {
  name: string;
  category_name: string;
  quantity_sold: number;
  gross_minor_units: number;
};

export type UsageReport = {
  time_range: { start_date: string; end_date: string };
  from_cache?: boolean;
  categories?: string[];
  sku_count?: number;
  totals: {
    quantity_sold: number;
    gross_minor_units: number;
    unique_items: number;
  };
  items: UsageLineItem[];
};

const ALL_CATEGORIES = "All";

async function fetchUsageReport(
  startDate: string,
  endDate: string,
  refresh: boolean,
): Promise<UsageReport> {
  const qs = new URLSearchParams({ start_date: startDate, end_date: endDate });
  if (refresh) qs.set("refresh", "true");
  const res = await fetch(`/api/usage?${qs}`);
  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      res.ok
        ? "Invalid API response"
        : `API ${res.status}: ${text.slice(0, 160).trim() || res.statusText}`,
    );
  }
  if (!res.ok) {
    const detail = data.detail;
    throw new Error(typeof detail === "string" ? detail : "Failed to load usage data");
  }
  return data as UsageReport;
}

type Props = {
  active: boolean;
};

export default function UsagePanel({ active }: Props) {
  const initial = lastWeekRange();
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<UsageReport | null>(null);

  const load = useCallback(
    async (opts?: { refresh?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchUsageReport(startDate, endDate, Boolean(opts?.refresh));
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

  useEffect(() => {
    if (active && !report && !loading) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const categoryOptions = useMemo(() => {
    const fromApi = report?.categories ?? [];
    return [ALL_CATEGORIES, ...fromApi];
  }, [report?.categories]);

  const filteredRows = useMemo(() => {
    const items = report?.items ?? [];
    if (category === ALL_CATEGORIES) return filterUsageAllView(items);
    return items.filter((r) => r.category_name === category);
  }, [report?.items, category]);

  const filteredTotals = useMemo(() => {
    return {
      quantity_sold: filteredRows.reduce((s, r) => s + r.quantity_sold, 0),
      gross_minor_units: filteredRows.reduce((s, r) => s + r.gross_minor_units, 0),
      unique_items: filteredRows.filter((r) => r.quantity_sold > 0).length,
      sku_count: filteredRows.length,
    };
  }, [filteredRows]);

  return (
    <section className="panel">
      <p className="inventory-intro">
        Beer and liquor sales from Clover for the selected dates.
      </p>

      <div className="date-bar usage-filters">
        <div className="field">
          <label htmlFor="usage-category">Category</label>
          <select
            id="usage-category"
            className="category-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="usage-start">Start date</label>
          <input
            id="usage-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="usage-end">End date</label>
          <input
            id="usage-end"
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
      {loading && !report && (
        <div className="loading">Fetching usage from Clover…</div>
      )}

      {report && (
        <>
          <div className="stats">
            <div className="stat">
              <div className="label">SKUs shown</div>
              <div className="value">{filteredTotals.sku_count}</div>
            </div>
            <div className="stat">
              <div className="label">Units sold</div>
              <div className="value">{filteredTotals.quantity_sold}</div>
            </div>
            <div className="stat">
              <div className="label">Revenue</div>
              <div className="value money">
                {formatMoney(filteredTotals.gross_minor_units)}
              </div>
            </div>
            <div className="stat">
              <div className="label">Items with sales</div>
              <div className="value">{filteredTotals.unique_items}</div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Qty</th>
                  <th>Gross</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No sales in this category for the date range.</td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => (
                    <tr
                      key={row.name}
                      className={row.quantity_sold === 0 ? "row-zero" : undefined}
                    >
                      <td>{index + 1}</td>
                      <td>{row.name}</td>
                      <td className="dist-cell">{row.category_name}</td>
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
          <p className="usage-footer">
            {category === ALL_CATEGORIES ? "All categories" : category} ·{" "}
            {report.time_range.start_date} → {report.time_range.end_date}
            {report.from_cache ? " · served from cache" : " · fresh from Clover"}
          </p>
        </>
      )}
    </section>
  );
}
