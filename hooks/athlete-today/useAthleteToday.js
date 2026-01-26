// hooks/athlete-today/useAthleteToday.js
"use client";

import { useCallback, useMemo, useState } from "react";
import { addDays, labelForDate, prettyDate, toISODateLocal, safeJson } from "@/components/athlete-today/ui";

export function useAthleteToday({ authReady, user, isAthlete }) {
  const [loading, setLoading] = useState(true);
  const [dailyWorkout, setDailyWorkout] = useState(null);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  const [selectedDate, setSelectedDate] = useState(() => toISODateLocal(new Date()));

  const reload = useCallback(
    async (isoDate) => {
      const date = isoDate || selectedDate;

      setErr("");
      setLoading(true);
      try {
        let res = await fetch(`/api/athlete/workouts/byDate?date=${encodeURIComponent(date)}`, {
          credentials: "include",
        });

        if (!res.ok && (res.status === 404 || res.status === 405)) {
          res = await fetch("/api/athlete/workouts/today", { credentials: "include" });
        }

        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || "Failed to load workout");

        setDailyWorkout(data?.dailyWorkout || null);
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        setErr(e?.message || "Failed to load");
        setDailyWorkout(null);
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [selectedDate],
  );

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
        String(x?.Status || "").toLowerCase() === "completed",
    ).length;
    const totalCount = list.length;
    const pct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

    return { completedCount, totalCount, pct };
  }, [items]);

  // Keep same return signature used by page
  return {
    selectedDate,
    setSelectedDate,

    loading,
    dailyWorkout,
    items,
    err,
    setErr,

    reload,
    dateStrip,
    progress,
  };
}
