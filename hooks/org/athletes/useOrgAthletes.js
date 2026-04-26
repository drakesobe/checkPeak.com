// hooks/org/athletes/useOrgAthletes.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeAthleteRecord, safeJson } from "@/lib/org/athletes/utils";

export function useOrgAthletes({ enabled }) {
  const abortRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [athletesRaw, setAthletesRaw] = useState([]);

  const athletes = useMemo(() => {
    return (Array.isArray(athletesRaw) ? athletesRaw : []).map(raw => ({
      ...normalizeAthleteRecord(raw),
      sport: String(raw.sport || "").trim(), // re-attach after normalize strips it
    }));
  }, [athletesRaw]);

  const athletesMap = useMemo(() => {
    const m = new Map();
    for (const a of athletes) m.set(a.id, a);
    return m;
  }, [athletes]);

  const fetchAthletes = useCallback(async () => {
    try {
      abortRef.current?.abort?.();
    } catch {}
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/org/getAthletes`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load athletes.");

      const list = Array.isArray(data?.athletes) ? data.athletes : [];
      setAthletesRaw(list);
      return { ok: true };
    } catch (err) {
      if (err?.name === "AbortError") return { ok: false, aborted: true };
      console.error("[org/athletes] load error:", err);
      setError(err?.message || "Failed to load athletes.");
      return { ok: false, error: err?.message || "Failed to load athletes." };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    fetchAthletes();
  }, [enabled, fetchAthletes]);

  return {
    loading,
    error,
    athletes,
    athletesMap,
    fetchAthletes,
    setAthletesRaw, // exposed in case you ever want optimistic updates
  };
}