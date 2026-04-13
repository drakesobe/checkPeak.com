// hooks/athlete-today/useClassSchedules.js
import { useState, useEffect, useCallback, useRef } from "react";

const lsKey = (tok) => `cp_classes:${tok}`;
function lsGet(k) {
  try { return typeof window !== "undefined" ? localStorage.getItem(k) : null; }
  catch { return null; }
}
function lsSet(k, v) {
  try { if (typeof window !== "undefined") localStorage.setItem(k, v); }
  catch {}
}

export function useClassSchedules({ authReady, isAthlete, athleteToken }) {
  const [classSchedules, setClassSchedules] = useState([]);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!authReady || !isAthlete || !athleteToken) return;
    const cached = lsGet(lsKey(athleteToken));
    if (cached) { try { setClassSchedules(JSON.parse(cached)); } catch {} }
    fetch("/api/athlete/class-schedule", { method: "GET", credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.ok || !Array.isArray(data.schedules)) return;
        setClassSchedules(data.schedules);
        lsSet(lsKey(athleteToken), JSON.stringify(data.schedules));
      })
      .catch(() => {});
  }, [authReady, isAthlete, athleteToken]);

  const persist = useCallback((schedules) => {
    if (!athleteToken) return;
    lsSet(lsKey(athleteToken), JSON.stringify(schedules));
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/athlete/class-schedule", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules }),
      }).catch(() => {});
    }, 800);
  }, [athleteToken]);

  // id = null → create, id = string → update
  const upsertSchedule = useCallback((data, existingId = null) => {
    setClassSchedules(prev => {
      const next = existingId
        ? prev.map(c => c.id === existingId ? { ...c, ...data } : c)
        : [...prev, { id: `cls_${Date.now()}`, ...data }];
      persist(next);
      return next;
    });
  }, [persist]);

  const removeSchedule = useCallback((id) => {
    setClassSchedules(prev => {
      const next = prev.filter(c => c.id !== id);
      persist(next);
      return next;
    });
  }, [persist]);

  return { classSchedules, upsertSchedule, removeSchedule };
}