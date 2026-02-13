// hooks/org/useNutritionQueue.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export function useNutritionQueue({ enabled = true } = {}) {
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    needsAction: 0,
    missingCheckin: 0,
    lowAdherence: 0,
    noPlan: 0,
  });

  const [meta, setMeta] = useState({
    weekStartISO: "",
    generatedAt: "",
    athletesCount: 0,
  });

  const lastRefreshAtRef = useRef(0);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!enabled) return;

      if (!silent) {
        setLoading(true);
      }
      setError("");

      try {
        const res = await fetch("/api/org/nutrition/queue", {
          method: "GET",
          credentials: "include",
        });
        const json = await safeJson(res);
        if (!res.ok) throw new Error(json?.error || "Failed to load nutrition queue.");

        const list = Array.isArray(json?.rows) ? json.rows : [];
        const c = json?.counts || {};
        const m = json?.meta || {};

        setRows(list);
        setCounts({
          total: Number(c.total ?? list.length ?? 0),
          needsAction: Number(c.needsAction ?? 0),
          missingCheckin: Number(c.missingCheckin ?? 0),
          lowAdherence: Number(c.lowAdherence ?? 0),
          noPlan: Number(c.noPlan ?? 0),
        });

        setMeta({
          weekStartISO: String(m.weekStartISO || ""),
          generatedAt: String(m.generatedAt || ""),
          athletesCount: Number(m.athletesCount || 0),
        });

        lastRefreshAtRef.current = Date.now();
      } catch (e) {
        setError(e?.message || "Failed to load nutrition queue.");
        setRows([]);
        setCounts({ total: 0, needsAction: 0, missingCheckin: 0, lowAdherence: 0, noPlan: 0 });
        setMeta({ weekStartISO: "", generatedAt: "", athletesCount: 0 });
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [enabled]
  );

  // initial
  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, refresh]);

  // small helper: “Updated X mins ago”
  const lastUpdatedLabel = useMemo(() => {
    if (!meta.generatedAt) return "";
    try {
      const t = new Date(meta.generatedAt).getTime();
      if (!t) return "";
      const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
      if (mins <= 0) return "Updated just now";
      if (mins === 1) return "Updated 1 min ago";
      return `Updated ${mins} mins ago`;
    } catch {
      return "";
    }
  }, [meta.generatedAt]);

  return { loading, error, rows, counts, meta, lastUpdatedLabel, refresh };
}
