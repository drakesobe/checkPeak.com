// /hooks/org/useOrgOverview.js
"use client";

import { useCallback, useRef, useState } from "react";
import { safeJson } from "@/lib/org/dashboard-utils";

export function useOrgOverview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stats, setStats] = useState({
    totalAthletes: 0,
    totalPlans: 0,
    athletesWithPlans: 0,
    coveragePct: 0,
    activeLast30: 0,
    staleCount: 0,
  });

  const [athletes, setAthletes] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      abortRef.current?.abort?.();
    } catch {}
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/org/getOrgOverview`, {
        method: "GET",
        credentials: "include",
        signal: controller.signal,
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load org overview");

      setStats(data?.stats || {});
      setAthletes(Array.isArray(data?.athletes) ? data.athletes : []);
      setRecentActivity(Array.isArray(data?.recentActivity) ? data.recentActivity : []);
    } catch (err) {
      const name = String(err?.name || "").toLowerCase();
      if (name.includes("abort")) return;
      console.error("[useOrgOverview] refresh error:", err);
      setError(err?.message || "Failed to load organization overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  const abort = useCallback(() => {
    try {
      abortRef.current?.abort?.();
    } catch {}
  }, []);

  return {
    loading,
    error,
    stats,
    athletes,
    setAthletes,
    recentActivity,
    refresh,
    abort,
  };
}
