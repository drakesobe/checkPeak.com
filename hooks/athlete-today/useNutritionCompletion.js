"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function asISODate(v) {
  const s = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function makeEmptyCompletion() {
  return {
    breakfast: { mealDone: false, hydrationDone: false },
    lunch: { mealDone: false, hydrationDone: false },
    afternoon: { mealDone: false, hydrationDone: false },
    dinner: { mealDone: false, hydrationDone: false },
  };
}

function normalizeCompletion(input) {
  const base = makeEmptyCompletion();
  const c = input && typeof input === "object" ? input : {};
  const keys = ["breakfast", "lunch", "afternoon", "dinner"];
  for (const k of keys) {
    base[k] = {
      mealDone: Boolean(c?.[k]?.mealDone),
      hydrationDone: Boolean(c?.[k]?.hydrationDone),
    };
  }
  return base;
}

export function useNutritionCompletion({ authReady, user, isAthlete, selectedDate }) {
  const date = useMemo(() => asISODate(selectedDate), [selectedDate]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [completion, setCompletion] = useState(makeEmptyCompletion);

  // prevent spam saves while toggling quickly
  const saveTimerRef = useRef(null);

  const load = useCallback(async () => {
    if (!authReady || !user || !isAthlete) return;
    if (!date) return;

    setLoading(true);
    setErr("");

    try {
      const res = await fetch(
        `/api/athlete/nutrition/completion/upsert?date=${encodeURIComponent(date)}`,
        { method: "GET", credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load nutrition completion.");

      setCompletion(normalizeCompletion(data?.completion));
    } catch (e) {
      setErr(String(e?.message || "Failed to load nutrition completion."));
      setCompletion(makeEmptyCompletion());
    } finally {
      setLoading(false);
    }
  }, [authReady, user, isAthlete, date]);

  const saveNow = useCallback(
    async (nextCompletion) => {
      if (!authReady || !user || !isAthlete) return;
      if (!date) return;

      setSaving(true);
      setErr("");

      try {
        const res = await fetch("/api/athlete/nutrition/completion/upsert", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            completion: nextCompletion,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to save nutrition completion.");

        // keep state in sync with normalized server response
        setCompletion(normalizeCompletion(data?.completion));
      } catch (e) {
        setErr(String(e?.message || "Failed to save nutrition completion."));
        // keep local UI (don’t roll back unless you want)
      } finally {
        setSaving(false);
      }
    },
    [authReady, user, isAthlete, date]
  );

  // debounced save for rapid toggles
  const saveDebounced = useCallback(
    (nextCompletion) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveNow(nextCompletion);
      }, 250);
    },
    [saveNow]
  );

  // Load whenever date changes (or auth becomes ready)
  useEffect(() => {
    load();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [load]);

  // helper to update a single toggle (mealDone/hydrationDone)
  const setToggle = useCallback(
    (mealKey, field, value) => {
      const keys = ["breakfast", "lunch", "afternoon", "dinner"];
      if (!keys.includes(mealKey)) return;
      if (field !== "mealDone" && field !== "hydrationDone") return;

      setCompletion((prev) => {
        const next = normalizeCompletion(prev);
        next[mealKey] = { ...next[mealKey], [field]: Boolean(value) };
        saveDebounced(next);
        return next;
      });
    },
    [saveDebounced]
  );

  return {
    loading,
    saving,
    err,
    setErr,

    completion,
    setCompletion: (next) => {
      const norm = normalizeCompletion(next);
      setCompletion(norm);
      saveDebounced(norm);
    },

    setToggle,
    reload: load,
  };
}
