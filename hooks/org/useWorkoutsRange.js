// hooks/org/useWorkoutsRange.js
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { titleSport } from "@/lib/org/workoutsCalendar/sports";

function safeJson(res) {
  return res.json().catch(() => ({}));
}

export function useWorkoutsRange({ isEnabled, startISO, endISO, selectedSports }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [workouts, setWorkouts] = useState([]);

  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);

  const sportsKey = useMemo(() => {
    const s = Array.isArray(selectedSports) ? selectedSports : [];
    return s.slice().sort().join(",");
  }, [selectedSports]);

  const cacheKey = useMemo(() => {
    return `range|${startISO}|${endISO}|${sportsKey || "ALL"}`;
  }, [startISO, endISO, sportsKey]);

  const buildRangeURL = useCallback(() => {
    const params = new URLSearchParams();
    params.set("start", startISO);
    params.set("end", endISO);

    const selected = Array.isArray(selectedSports) ? selectedSports.filter(Boolean) : [];
    if (selected.length === 1) {
      params.set("sport", titleSport(selected[0]));
    } else if (selected.length > 1) {
      params.set("sports", selected.join(","));
      params.set("sport", titleSport(selected[0])); // fallback for older server
    }

    return `/api/org/workouts/range?${params.toString()}`;
  }, [startISO, endISO, selectedSports]);

  const fetchRange = useCallback(
    async (force = false) => {
      if (!isEnabled) return;
      setErr("");

      if (!force && cacheRef.current.has(cacheKey)) {
        setWorkouts(cacheRef.current.get(cacheKey));
        setLoading(false);
        return;
      }

      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {}
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      try {
        const url = buildRangeURL();
        const res = await fetch(url, { method: "GET", credentials: "include", signal: ctrl.signal });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || "Failed to load workouts range");

        const list = Array.isArray(data?.workouts) ? data.workouts : [];
        cacheRef.current.set(cacheKey, list);
        setWorkouts(list);
      } catch (e) {
        if (String(e?.name || "").toLowerCase().includes("abort")) return;
        setErr(e?.message || "Failed to load workouts.");
        setWorkouts([]);
      } finally {
        setLoading(false);
      }
    },
    [isEnabled, cacheKey, buildRangeURL]
  );

  return { loading, err, workouts, fetchRange };
}
