// hooks/athlete-today/useAthleteToday.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, labelForDate, prettyDate, toISODateLocal, safeJson } from "@/components/athlete-today/ui";

function safeText(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function isISODateOnly(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

export function useAthleteToday({ authReady, user, isAthlete }) {
  const [loading, setLoading] = useState(true);
  const [dailyWorkout, setDailyWorkout] = useState(null);
  const [dailyWorkouts, setDailyWorkouts] = useState([]);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  const [selectedDate, setSelectedDate] = useState(() => toISODateLocal(new Date()));

  // ✅ Dedupe + cancel in-flight
  const lastLoadedDateRef = useRef("");
  const inflightRef = useRef(null);

  const reload = useCallback(
    async (isoDate, opts = {}) => {
      const force = Boolean(opts?.force);
      const date = safeText(isoDate || selectedDate);

      // If date invalid, don't fetch
      if (!isISODateOnly(date)) return;

      // Don't refetch same date unless forced
      if (!force && lastLoadedDateRef.current === date && !err) return;

      // Abort previous request (prevents race conditions + duplicate spam)
      try {
        inflightRef.current?.abort?.();
      } catch {
        // ignore
      }

      const controller = new AbortController();
      inflightRef.current = controller;

      setErr("");
      setLoading(true);

      try {
        let res = await fetch(`/api/athlete/workouts/byDate?date=${encodeURIComponent(date)}`, {
          credentials: "include",
          signal: controller.signal,
        });

        // Fallback for legacy endpoints if needed
        if (!res.ok && (res.status === 404 || res.status === 405)) {
          res = await fetch("/api/athlete/workouts/today", {
            credentials: "include",
            signal: controller.signal,
          });
        }

        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || "Failed to load workout");

        setDailyWorkout(data?.dailyWorkout || null);
        setDailyWorkouts(Array.isArray(data?.dailyWorkouts) ? data.dailyWorkouts : []);
        setItems(Array.isArray(data?.items) ? data.items : []);

        // mark success for dedupe
        lastLoadedDateRef.current = date;
      } catch (e) {
        if (String(e?.name || "") === "AbortError") return;

        setErr(e?.message || "Failed to load");
        setDailyWorkout(null);
        setDailyWorkouts([]);
        setItems([]);

        // do NOT set lastLoadedDateRef here so user can retry
      } finally {
        setLoading(false);
      }
    },
    [selectedDate, err]
  );

  /**
   * ✅ Auto-load once when auth is ready
   * This prevents you from needing a page-level effect that double-fetches.
   * StrictMode may run effects twice in dev, but dedupe + abort prevents spam.
   */
  useEffect(() => {
    if (!authReady) return;
    if (!user) return;
    if (!isAthlete) return;

    reload(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user, isAthlete]);

  const dateStrip = useMemo(() => {
    const base = new Date(`${selectedDate}T12:00:00`);
    const start = addDays(base, -3);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(start, i);
      const iso = toISODateLocal(d);
      return { iso, label: labelForDate(iso), pretty: prettyDate(iso) };
    });
  }, [selectedDate]);

  const progress = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    const completedCount = list.filter(
      (x) =>
        String(x?.Completed || x?.completed || "").toLowerCase() === "true" ||
        String(x?.Status || "").toLowerCase() === "completed"
    ).length;

    const totalCount = list.length;
    const pct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

    return { completedCount, totalCount, pct };
  }, [items]);

  return {
    selectedDate,
    setSelectedDate,

    loading,
    dailyWorkout,
    dailyWorkouts,
    items,
    err,
    setErr,

    reload,
    dateStrip,
    progress,
  };
}