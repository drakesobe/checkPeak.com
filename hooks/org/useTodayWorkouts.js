// /hooks/org/useTodayWorkouts.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nyDateISO, safeJson } from "@/lib/org/dashboard-utils";

function normKey(s) {
  return String(s || "").trim().toLowerCase();
}

export function useTodayWorkouts({ isOrgSide }) {
  const [sport, setSport] = useState("Basketball");
  const [availableSports, setAvailableSports] = useState([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [day, setDay] = useState({
    workouts: [],
    itemsByWorkoutId: {},
    completionByItemId: {},
  });

  const abortRef = useRef(null);
  const todayISO = useMemo(() => nyDateISO(), []);

  // ✅ Only consider init "done" once we have a real sports list
  const didInitSportRef = useRef(false);

  const fetchToday = useCallback(async () => {
    if (!isOrgSide) return;

    try {
      abortRef.current?.abort?.();
    } catch {}
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setErr("");

    try {
      const res = await fetch(
        `/api/org/workouts/day?date=${encodeURIComponent(todayISO)}&sport=${encodeURIComponent(
          sport
        )}`,
        { method: "GET", credentials: "include", signal: controller.signal }
      );

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load today's workouts");

      const sports = Array.isArray(data?.availableSports) ? data.availableSports : [];
      setAvailableSports(sports);

      // ✅ Initialize/repair selection once we actually know the day’s sports
      if (sports.length > 0) {
        const current = normKey(sport);
        const hasCurrent = sports.some((s) => normKey(s) === current);

        // If current isn't valid, switch to first available sport.
        // Allow this even if init already happened, because sports can change day-to-day.
        if (!hasCurrent) {
          // Avoid flip-flop if the first sport is already selected
          const next = sports[0];
          if (normKey(next) !== current) {
            // This triggers a refetch via dependency, intended.
            setSport(next);
          }
        }

        // Mark init only after we had real sports at least once
        if (!didInitSportRef.current) didInitSportRef.current = true;
      }

      setDay({
        workouts: Array.isArray(data?.workouts) ? data.workouts : [],
        itemsByWorkoutId: data?.itemsByWorkoutId || {},
        completionByItemId: data?.completionByItemId || {},
      });
    } catch (e) {
      const msg = String(e?.name || "").toLowerCase();
      if (msg.includes("abort")) return;

      setErr(e?.message || "Failed to load");
      setAvailableSports([]);
      setDay({ workouts: [], itemsByWorkoutId: {}, completionByItemId: {} });
    } finally {
      setLoading(false);
    }
  }, [isOrgSide, sport, todayISO]);

  useEffect(() => {
    fetchToday();
    return () => {
      try {
        abortRef.current?.abort?.();
      } catch {}
    };
  }, [fetchToday]);

  const summary = useMemo(() => {
    const workouts = Array.isArray(day?.workouts) ? day.workouts : [];
    const itemsByWorkoutId = day?.itemsByWorkoutId || {};
    const completionByItemId = day?.completionByItemId || {};

    let workoutCount = workouts.length;
    let itemCount = 0;
    let completedCount = 0;
    let pendingReviewCount = 0;
    let rejectedCount = 0;
    let athleteSum = 0;

    workouts.forEach((w) => {
      athleteSum += Number(w?.athleteCount || 0);
      const wid = String(w?.id || "");
      const items = Array.isArray(itemsByWorkoutId?.[wid]) ? itemsByWorkoutId[wid] : [];
      itemCount += items.length;

      items.forEach((it) => {
        const itemId = String(it?.id || "");
        const completion = completionByItemId?.[itemId] || null;
        const status = String(completion?.Status || "").toLowerCase();

        if (!completion) return;
        if (status === "completed") completedCount += 1;
        else if (status === "pending_review") pendingReviewCount += 1;
        else rejectedCount += 1;
      });
    });

    const completionPct = itemCount > 0 ? Math.round((completedCount / itemCount) * 100) : 0;

    return {
      workoutCount,
      itemCount,
      athleteSum,
      completedCount,
      pendingReviewCount,
      rejectedCount,
      completionPct,
    };
  }, [day]);

  const list = useMemo(() => {
    const workouts = Array.isArray(day?.workouts) ? [...day.workouts] : [];
    workouts.sort((a, b) => String(a?.Title || "").localeCompare(String(b?.Title || "")));
    return workouts;
  }, [day]);

  return {
    sport,
    setSport,
    availableSports,
    loading,
    err,
    day,
    todayISO,
    fetchToday,
    summary,
    list,
  };
}
