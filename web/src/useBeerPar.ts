import { useCallback, useEffect, useMemo, useState } from "react";

export type BeerParItem = {
  name: string;
  wat_par: number;
  lu_par: number;
  avg_weekly?: number;
  weeks_with_data?: number;
};

type BeerParResponse = {
  ok: boolean;
  items: BeerParItem[];
  detail?: string;
  from_cache?: boolean;
};

type BeerParUpdateResponse = {
  ok: boolean;
  mode?: string;
  order_week?: { start: string; end: string; label?: string };
  sync?: { weeks_synced?: unknown[]; rows_upserted?: number };
  par?: BeerParResponse;
  detail?: string;
};

let cachedByName: Map<string, BeerParItem> | null = null;

export function clearBeerParCache() {
  cachedByName = null;
}

export function useBeerPar(active: boolean, weeks = 6) {
  const [items, setItems] = useState<BeerParItem[]>(() =>
    cachedByName ? [...cachedByName.values()] : [],
  );
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOrderWeekEnd, setLastOrderWeekEnd] = useState<string | null>(null);

  const applyParItems = useCallback((list: BeerParItem[]) => {
    cachedByName = new Map(list.map((i) => [i.name.toLowerCase(), i]));
    setItems(list);
  }, []);

  const load = useCallback(
    async (force = false) => {
      if (!force && cachedByName && cachedByName.size > 0) {
        setItems([...cachedByName.values()]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const qs = force ? "&refresh=true" : "";
        const res = await fetch(`/api/suggested-par?weeks=${weeks}${qs}`);
        const text = await res.text();
        let data: BeerParResponse;
        try {
          data = JSON.parse(text) as BeerParResponse;
        } catch {
          throw new Error(`API ${res.status}: ${text.slice(0, 160)}`);
        }
        if (!res.ok) {
          throw new Error(data.detail || "Failed to load beer par");
        }
        applyParItems(data.items ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load beer par");
      } finally {
        setLoading(false);
      }
    },
    [weeks, applyParItems],
  );

  const updateForOrders = useCallback(async () => {
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch("/api/beer-par/update?refresh=true", { method: "POST" });
      const text = await res.text();
      let data: BeerParUpdateResponse;
      try {
        data = JSON.parse(text) as BeerParUpdateResponse;
      } catch {
        throw new Error(`API ${res.status}: ${text.slice(0, 160)}`);
      }
      if (!res.ok) {
        throw new Error(data.detail || "Failed to update par");
      }
      clearBeerParCache();
      const list = data.par?.items ?? [];
      applyParItems(list);
      const weekEnd = data.order_week?.end ?? null;
      setLastOrderWeekEnd(weekEnd);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update par");
      return null;
    } finally {
      setUpdating(false);
    }
  }, [applyParItems]);

  useEffect(() => {
    if (active) load();
  }, [active, load]);

  const byName = useMemo(
    () => new Map(items.map((i) => [i.name.toLowerCase(), i])),
    [items],
  );

  return {
    items,
    byName,
    loading,
    updating,
    error,
    lastOrderWeekEnd,
    reload: load,
    updateForOrders,
  };
}
