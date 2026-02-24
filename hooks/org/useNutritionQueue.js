// hooks/org/useNutritionQueue.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * UPDATED:
 * ✅ Now uses /api/org/nutrition/table as source of truth
 * ✅ Derives counts + meta from rows (sports/teams dropdown fuel)
 * ✅ Keeps the same return shape (rows, counts, meta, refresh...)
 *
 * Notes:
 * - /api/org/nutrition/table returns: { ok: true, rows: [...] }
 * - Each row may contain { plan, completion, adherenceAvg, sport, team }
 */

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function safeObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function asString(v) {
  return String(v ?? "").trim();
}

function clampPct(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function hasPlan(r) {
  const p = r?.plan;
  return Boolean(p && (p?.daily || p?.phase || p?.createdAt));
}

function hasCompletion(r) {
  const c = r?.completion;
  return Boolean(c && (c?.totalPct != null || c?.mealPct != null || c?.hydrationPct != null));
}

function normalizeCountsFromRows(rows = []) {
  const list = safeArray(rows);

  // tune thresholds if you want
  const LOW_ADHERENCE_THRESHOLD = 65;

  let noPlan = 0;
  let missingCheckin = 0;
  let lowAdherence = 0;

  for (const r of list) {
    const planOk = hasPlan(r);
    const compOk = hasCompletion(r);
    const avg = clampPct(r?.adherenceAvg ?? r?.completion?.totalPct);

    if (!planOk) noPlan += 1;
    if (!compOk) missingCheckin += 1;
    if (avg != null && avg < LOW_ADHERENCE_THRESHOLD) lowAdherence += 1;
  }

  const needsAction = noPlan + missingCheckin + lowAdherence;

  return {
    total: list.length,
    needsAction,
    missingCheckin,
    lowAdherence,
    noPlan,
  };
}

function normalizeMetaFromRows(rows = []) {
  const list = safeArray(rows);

  const sportsSet = new Set();
  const teamsSet = new Set();
  const teamsBySport = {};

  for (const r of list) {
    const sport = asString(r?.sport);
    const team = asString(r?.team);

    if (sport) sportsSet.add(sport);
    if (team) teamsSet.add(team);

    if (sport && team) {
      if (!teamsBySport[sport]) teamsBySport[sport] = [];
      if (!teamsBySport[sport].includes(team)) teamsBySport[sport].push(team);
    }
  }

  const sports = Array.from(sportsSet).sort((a, b) => a.localeCompare(b));
  const teams = Array.from(teamsSet).sort((a, b) => a.localeCompare(b));

  // sort teams within each sport for stable dropdowns
  Object.keys(teamsBySport).forEach((s) => {
    teamsBySport[s].sort((a, b) => a.localeCompare(b));
  });

  return {
    weekStartISO: "", // optional: you can compute it later if needed
    generatedAt: new Date().toISOString(),
    athletesCount: list.length,
    sports,
    teams,
    teamsBySport,
  };
}

function makeEmpty() {
  return {
    rows: [],
    counts: { total: 0, needsAction: 0, missingCheckin: 0, lowAdherence: 0, noPlan: 0 },
    meta: {
      weekStartISO: "",
      generatedAt: "",
      athletesCount: 0,
      sports: [],
      teams: [],
      teamsBySport: {},
    },
  };
}

/**
 * Tiny in-memory cache (per session).
 * Keyed by endpoint since org cookie determines org.
 */
const CACHE = {
  queue: {
    data: null,
    savedAt: 0,
  },
};

export function useNutritionQueue({ enabled = true, swr = true, cacheTtlMs = 60_000 } = {}) {
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
    sports: [],
    teams: [],
    teamsBySport: {},
  });

  const mountedRef = useRef(false);
  const abortRef = useRef(null);
  const inflightRef = useRef(null);
  const requestSeqRef = useRef(0);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const hydrateFromCache = useCallback(() => {
    const cached = CACHE.queue.data;
    const savedAt = CACHE.queue.savedAt;
    if (!cached) return false;

    const cachedRows = safeArray(cached.rows);
    setRows(cachedRows);

    setCounts(safeObject(cached.counts));
    setMeta(safeObject(cached.meta));

    lastRefreshAtRef.current = savedAt || Date.now();
    return true;
  }, []);

  const writeCache = useCallback((payload) => {
    CACHE.queue.data = payload;
    CACHE.queue.savedAt = Date.now();
  }, []);

  const refresh = useCallback(
    async ({ silent = false, force = false } = {}) => {
      if (!enabled) return;
      if (!mountedRef.current) return;

      if (inflightRef.current && !force) return inflightRef.current;

      const now = Date.now();
      const cacheAge = now - (CACHE.queue.savedAt || 0);
      const cacheIsFresh = CACHE.queue.data && cacheAge <= cacheTtlMs;

      if (cacheIsFresh && !force) {
        hydrateFromCache();
        return;
      }

      if (!silent) setLoading(true);
      setError("");

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const seq = ++requestSeqRef.current;

      const p = (async () => {
        try {
          // ✅ IMPORTANT: source of truth is TABLE API now
          const res = await fetch("/api/org/nutrition/table", {
            method: "GET",
            credentials: "include",
            signal: controller.signal,
          });

          const json = await safeJson(res);
          if (!res.ok) throw new Error(json?.error || "Failed to load nutrition table.");

         const raw = safeArray(json?.rows);

          const LOW_ADHERENCE_THRESHOLD = 65;

          const list = raw.map((r) => {
            const planOk = Boolean(r?.plan && (r?.plan?.daily || r?.plan?.phase || r?.plan?.createdAt));
            const compOk = Boolean(r?.completion && (r?.completion?.totalPct != null || r?.completion?.mealPct != null || r?.completion?.hydrationPct != null));

            const avg = clampPct(r?.adherenceAvg ?? r?.completion?.totalPct);
            const noPlan = !planOk;
            const missingCheckin = !compOk;
            const lowAdherence = avg != null && avg < LOW_ADHERENCE_THRESHOLD;

            const needsAction = noPlan || missingCheckin || lowAdherence;

  // ✅ Add the fields your existing filters likely expect
  return {
    ...r,
    needsAction,
    noPlan,
    missingCheckin,
    lowAdherence,

    // optional: nice for UI badges/filters later
    actionReason: noPlan ? "noPlan" : missingCheckin ? "missingCheckin" : lowAdherence ? "lowAdherence" : "",
  };
});

          const c = normalizeCountsFromRows(list);
          const m = normalizeMetaFromRows(list);

          if (!mountedRef.current) return;
          if (seq !== requestSeqRef.current) return;

          setRows(list);
          setCounts(c);
          setMeta(m);

          writeCache({ rows: list, counts: c, meta: m });
          lastRefreshAtRef.current = Date.now();
        } catch (e) {
          if (e?.name === "AbortError") return;

          if (!mountedRef.current) return;
          if (seq !== requestSeqRef.current) return;

          setError(e?.message || "Failed to load nutrition table.");

          const empty = makeEmpty();
          setRows(empty.rows);
          setCounts(empty.counts);
          setMeta(empty.meta);
        } finally {
          if (!mountedRef.current) return;
          if (seq !== requestSeqRef.current) return;

          if (!silent) setLoading(false);
          inflightRef.current = null;
        }
      })();

      inflightRef.current = p;
      return p;
    },
    [enabled, cacheTtlMs, hydrateFromCache, writeCache]
  );

  useEffect(() => {
    if (!enabled) return;

    if (swr) {
      const hadCache = hydrateFromCache();
      refresh({ silent: hadCache, force: true });
    } else {
      refresh({ silent: false, force: true });
    }
  }, [enabled, swr, hydrateFromCache, refresh]);

  const lastUpdatedLabel = useMemo(() => {
    const base = meta.generatedAt ? new Date(meta.generatedAt).getTime() : lastRefreshAtRef.current;
    if (!base) return "";

    const mins = Math.max(0, Math.round((Date.now() - base) / 60000));
    if (mins <= 0) return "Updated just now";
    if (mins === 1) return "Updated 1 min ago";
    return `Updated ${mins} mins ago`;
  }, [meta.generatedAt, rows?.length, counts?.total]);

  const lastRefreshAt = useMemo(() => lastRefreshAtRef.current, [meta.generatedAt]);

  const isStale = useMemo(() => {
    const savedAt = CACHE.queue.savedAt || 0;
    if (!savedAt) return true;
    return Date.now() - savedAt > cacheTtlMs;
  }, [cacheTtlMs, meta.generatedAt]);

  return {
    loading,
    error,
    rows,
    counts,
    meta,
    lastUpdatedLabel,
    lastRefreshAt,
    isStale,
    refresh,
  };
}