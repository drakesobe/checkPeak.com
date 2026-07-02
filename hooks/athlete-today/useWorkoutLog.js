// hooks/athlete-today/useWorkoutLog.js
"use client";

import { useCallback } from "react";

const lsKey = (token) => `checkpeak:workoutLog:${token || "anon"}`;
const MAX_ENTRIES = 5000;

export function useWorkoutLog({ athleteToken, selectedDate }) {

  const getAllLogs = useCallback(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(lsKey(athleteToken)) || "[]"); }
    catch { return []; }
  }, [athleteToken]);

  // Save one set's log entry — returns Promise resolving to { ...record, supabaseId? }
  const saveSetLog = useCallback(async (entry) => {
    if (typeof window === "undefined") return null;
    try {
      const record = {
        id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp:  Date.now(),
        date:       selectedDate,
        athleteToken,
        ...entry,
      };
      const updated = [record, ...getAllLogs()].slice(0, MAX_ENTRIES);
      localStorage.setItem(lsKey(athleteToken), JSON.stringify(updated));

      // Sync to API and capture Supabase UUID for video attachment
      try {
        const r = await fetch("/api/athlete/workouts/logSet", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record),
        });
        if (r.ok) {
          const json = await r.json();
          if (json.id) return { ...record, supabaseId: json.id };
        }
      } catch {}

      return record;
    } catch { return null; }
  }, [athleteToken, selectedDate, getAllLogs]);

  // Get all logged sets for a specific exercise title
  const getExerciseLogs = useCallback((exerciseTitle, days = 120) => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return getAllLogs()
      .filter(l => l.exerciseTitle === exerciseTitle && l.timestamp > cutoff);
  }, [getAllLogs]);

  // Group logs by date, returning an array of sessions (most recent first)
  const getExerciseSessions = useCallback((exerciseTitle, days = 120) => {
    const logs = getExerciseLogs(exerciseTitle, days);
    const byDate = {};
    logs.forEach(l => {
      if (!byDate[l.date]) byDate[l.date] = [];
      byDate[l.date].push(l);
    });
    return Object.entries(byDate)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, sets]) => ({
        date,
        sets,
        maxWeight: Math.max(...sets.map(s => Number(s.actualWeight) || 0)),
        maxReps:   Math.max(...sets.map(s => Number(s.actualReps)   || 0)),
        totalSets: sets.length,
        avgEffort: sets.filter(s => s.effort > 0).length > 0
          ? (sets.reduce((a, s) => a + (s.effort || 0), 0) / sets.filter(s => s.effort > 0).length).toFixed(1)
          : null,
      }));
  }, [getExerciseLogs]);

  return { saveSetLog, getAllLogs, getExerciseLogs, getExerciseSessions };
}