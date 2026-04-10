// hooks/org/useNutritionQueue.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

async function safeJson(res) {
  try { return await res.json(); } catch { return {}; }
}

function safeArray(v)  { return Array.isArray(v) ? v : []; }
function safeObject(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
function asString(v)   { return String(v ?? "").trim(); }

function clampPct(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function planOkFromRow(r) {
  const p = r?.plan;
  return Boolean(p && (p?.daily || p?.phase || p?.createdAt || p?.calories || p?.protein));
}

function completionOkFromRow(r) {
  const c = r?.completion;
  return Boolean(
    c && (c?.totalPct != null || c?.mealPct != null || c?.hydrationPct != null)
  );
}

const LOW_ADHERENCE_THRESHOLD = 65;

function normalizeRow(r) {
  const planOk = planOkFromRow(r);
  const compOk = completionOkFromRow(r);
  const avg    = clampPct(r?.adherenceAvg ?? r?.completion?.totalPct);

  const hasPlan        = planOk;
  const noPlan         = !planOk;
  const missingCheckin = !compOk;
  const lowAdherence   = avg != null && avg < LOW_ADHERENCE_THRESHOLD;
  const needsAction    = noPlan || missingCheckin || lowAdherence;

  return {
    ...r,
    hasPlan,
    noPlan,
    missingCheckin,
    lowAdherence,
    needsAction,
    adherenceAvg: avg ?? r?.adherenceAvg ?? null,
    actionReason: noPlan         ? "noPlan"
                : missingCheckin ? "missingCheckin"
                : lowAdherence   ? "lowAdherence"
                : "",
  };
}

function normalizeCountsFromRows(rows = []) {
  const list = safeArray(rows);
  let noPlan = 0, missingCheckin = 0, lowAdherence = 0;
  for (const r of list) {
    if (!r.hasPlan)       noPlan        += 1;
    if (r.missingCheckin) missingCheckin += 1;
    if (r.lowAdherence)   lowAdherence   += 1;
  }
  return {
    total:         list.length,
    needsAction:   list.filter(r => r.needsAction).length,
    missingCheckin,
    lowAdherence,
    noPlan,
  };
}

function normalizeMetaFromRows(rows = []) {
  const list       = safeArray(rows);
  const sportsSet  = new Set();
  const teamsSet   = new Set();
  const teamsBySport = {};

  for (const r of list) {
    const sport = asString(r?.sport);
    const team  = asString(r?.team);
    if (sport) sportsSet.add(sport);
    if (team)  teamsSet.add(team);
    if (sport && team) {
      if (!teamsBySport[sport]) teamsBySport[sport] = [];
      if (!teamsBySport[sport].includes(team)) teamsBySport[sport].push(team);
    }
  }
  Object.keys(teamsBySport).forEach(s => {
    teamsBySport[s].sort((a, b) => a.localeCompare(b));
  });

  return {
    weekStartISO:  "",
    generatedAt:   new Date().toISOString(),
    athletesCount: list.length,
    sports:        Array.from(sportsSet).sort((a, b) => a.localeCompare(b)),
    teams:         Array.from(teamsSet).sort((a, b)  => a.localeCompare(b)),
    teamsBySport,
  };
}

function makeEmpty() {
  return {
    rows:   [],
    counts: { total: 0, needsAction: 0, missingCheckin: 0, lowAdherence: 0, noPlan: 0 },
    meta:   { weekStartISO: "", generatedAt: "", athletesCount: 0, sports: [], teams: [], teamsBySport: {} },
  };
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
const CACHE = { queue: { data: null, savedAt: 0 } };

export function useNutritionQueue({ enabled = true, swr = true, cacheTtlMs = 60_000 } = {}) {
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [rows,    setRows]    = useState([]);
  const [counts,  setCounts]  = useState(makeEmpty().counts);
  const [meta,    setMeta]    = useState(makeEmpty().meta);

  const mountedRef       = useRef(false);
  const abortRef         = useRef(null);
  const inflightRef      = useRef(null);
  const requestSeqRef    = useRef(0);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const hydrateFromCache = useCallback(() => {
    const cached = CACHE.queue.data;
    if (!cached) return false;
    setRows(safeArray(cached.rows));
    setCounts(safeObject(cached.counts));
    setMeta(safeObject(cached.meta));
    lastRefreshAtRef.current = CACHE.queue.savedAt || Date.now();
    return true;
  }, []);

  const writeCache = useCallback((payload) => {
    CACHE.queue.data    = payload;
    CACHE.queue.savedAt = Date.now();
  }, []);

  const refresh = useCallback(
    async ({ silent = false, force = false } = {}) => {
      if (!enabled || !mountedRef.current) return;
      if (inflightRef.current && !force) return inflightRef.current;

      const cacheAge     = Date.now() - (CACHE.queue.savedAt || 0);
      const cacheIsFresh = CACHE.queue.data && cacheAge <= cacheTtlMs;
      if (cacheIsFresh && !force) { hydrateFromCache(); return; }

      if (!silent) setLoading(true);
      setError("");

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const seq        = ++requestSeqRef.current;

      const p = (async () => {
        try {
          const res  = await fetch("/api/org/nutrition/table", {
            method: "GET", credentials: "include", signal: controller.signal,
          });
          const json = await safeJson(res);
          if (!res.ok) throw new Error(json?.error || "Failed to load nutrition table.");

          const list = safeArray(json?.rows).map(normalizeRow);
          const c    = normalizeCountsFromRows(list);
          const m    = normalizeMetaFromRows(list);

          if (!mountedRef.current || seq !== requestSeqRef.current) return;

          setRows(list);
          setCounts(c);
          setMeta(m);
          writeCache({ rows: list, counts: c, meta: m });
          lastRefreshAtRef.current = Date.now();
        } catch (e) {
          if (e?.name === "AbortError") return;
          if (!mountedRef.current || seq !== requestSeqRef.current) return;

          setError(e?.message || "Failed to load nutrition table.");
          const empty = makeEmpty();
          setRows(empty.rows);
          setCounts(empty.counts);
          setMeta(empty.meta);
        } finally {
          if (!mountedRef.current || seq !== requestSeqRef.current) return;
          if (!silent) setLoading(false);
          inflightRef.current = null;
        }
      })();

      inflightRef.current = p;
      return p;
    },
    [enabled, cacheTtlMs, hydrateFromCache, writeCache]
  );

  // KEY FIX: when enabled is false (auth not yet ready), drop the loading
  // spinner immediately rather than hanging on the skeleton indefinitely.
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (swr) {
      const hadCache = hydrateFromCache();
      refresh({ silent: hadCache, force: true });
    } else {
      refresh({ silent: false, force: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const lastUpdatedLabel = useMemo(() => {
    const base = meta.generatedAt
      ? new Date(meta.generatedAt).getTime()
      : lastRefreshAtRef.current;
    if (!base) return "";
    const mins = Math.max(0, Math.round((Date.now() - base) / 60000));
    if (mins <= 0) return "Updated just now";
    if (mins === 1) return "Updated 1 min ago";
    return `Updated ${mins} mins ago`;
  }, [meta.generatedAt, rows?.length, counts?.total]);

  const lastRefreshAt = useMemo(
    () => lastRefreshAtRef.current,
    [meta.generatedAt]
  );

  const isStale = useMemo(() => {
    const savedAt = CACHE.queue.savedAt || 0;
    if (!savedAt) return true;
    return Date.now() - savedAt > cacheTtlMs;
  }, [cacheTtlMs, meta.generatedAt]);

  return { loading, error, rows, counts, meta, lastUpdatedLabel, lastRefreshAt, isStale, refresh };
}