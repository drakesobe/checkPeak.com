// /hooks/dashboard/useTodaySummary.js
"use client";

import { useEffect, useState } from "react";

export function useTodaySummary({ userEmail }) {
  const [todaySummary, setTodaySummary] = useState({
    hasWorkout: false,
    title: "",
    status: "",
    itemsCount: 0,
    completedCount: 0,
  });
  const [loadingToday, setLoadingToday] = useState(false);

  useEffect(() => {
    if (!userEmail) return;

    let cancelled = false;

    async function loadToday() {
      setLoadingToday(true);
      try {
        const res = await fetch("/api/athlete/workouts/today", {
          method: "GET",
          credentials: "include",
        });

        const data = res.ok ? await res.json().catch(() => ({})) : null;
        if (cancelled) return;

        const dw = data?.dailyWorkout || null;
        const items = Array.isArray(data?.items) ? data.items : [];

        const completedCount = items.filter((it) => {
          const v = it?.Completed;
          if (v === true) return true;
          const s = String(v || "").toLowerCase();
          return s === "true" || s === "1" || s === "yes";
        }).length;

        setTodaySummary({
          hasWorkout: !!dw,
          title: dw?.Title || "",
          status: dw?.Status || "",
          itemsCount: items.length,
          completedCount,
        });
      } catch {
        if (!cancelled) {
          setTodaySummary({
            hasWorkout: false,
            title: "",
            status: "",
            itemsCount: 0,
            completedCount: 0,
          });
        }
      } finally {
        if (!cancelled) setLoadingToday(false);
      }
    }

    loadToday();

    return () => {
      cancelled = true;
    };
  }, [userEmail]);

  return { todaySummary, loadingToday };
}
