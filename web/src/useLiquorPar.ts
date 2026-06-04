import { useCallback, useEffect, useMemo, useState } from "react";

export type LiquorParItem = {
  name: string;
  wat_par: number;
  lu_par: number;
  source?: string;
};

type LiquorParResponse = {
  ok: boolean;
  items: LiquorParItem[];
  detail?: string;
  from_cache?: boolean;
};

let cachedByName: Map<string, LiquorParItem> | null = null;

export function useLiquorPar(active: boolean) {
  const [items, setItems] = useState<LiquorParItem[]>(() =>
    cachedByName ? [...cachedByName.values()] : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (!force && cachedByName && cachedByName.size > 0) {
      setItems([...cachedByName.values()]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = force ? "?refresh=true" : "";
      const res = await fetch(`/api/liquor-par${qs}`);
      const text = await res.text();
      let data: LiquorParResponse;
      try {
        data = JSON.parse(text) as LiquorParResponse;
      } catch {
        throw new Error(`API ${res.status}: ${text.slice(0, 160)}`);
      }
      if (!res.ok) {
        throw new Error(data.detail || "Failed to load liquor par");
      }
      const list = data.items ?? [];
      cachedByName = new Map(list.map((i) => [i.name.toLowerCase(), i]));
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load liquor par");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) load();
  }, [active, load]);

  const byName = useMemo(
    () => new Map(items.map((i) => [i.name.toLowerCase(), i])),
    [items],
  );

  return { items, byName, loading, error, reload: load };
}
