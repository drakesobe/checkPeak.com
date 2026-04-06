// hooks/athlete-today/useDayPlanner.js
// Orchestrator hook for the Day Planner page.
//
// Fetches workout and nutrition data from existing endpoints,
// merges them with the athlete's class schedule,
// and produces a unified list of draggable "blocks".
//
// Data sources:
//   Workouts  → /api/athlete/today  (existing endpoint via useAthleteToday)
//   Nutrition → /api/athlete/nutrition/today  (existing endpoint)
//   Classes   → localStorage via useDayPlannerClasses
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useDayPlannerClasses } from "./useDayPlannerClasses";
import { useDayPlannerOrder }   from "./useDayPlannerOrder";

/* ─── Local storage helpers ──────────────────────────────────────────────── */

function lsGet(key) {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function lsSet(key, val) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/* ─── Date helpers ───────────────────────────────────────────────────────── */

export function toISODateLocal(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dy}`;
}

export function todayISO() {
  return toISODateLocal(new Date());
}

/* ─── Meal block definitions ─────────────────────────────────────────────── */

const MEAL_BLOCKS = [
  { id: "breakfast", label: "Breakfast",        time: "7:00 AM",  icon: "🥣" },
  { id: "lunch",     label: "Lunch",            time: "12:00 PM", icon: "🥗" },
  { id: "afternoon", label: "Pre-Workout Fuel", time: "3:00 PM",  icon: "⚡" },
  { id: "dinner",    label: "Dinner",           time: "7:00 PM",  icon: "🍽️" },
];

/* ─── Fetch helpers ──────────────────────────────────────────────────────── */

async function safeJson(res) {
  try { return await res.json(); } catch { return {}; }
}

/**
 * Fetch athlete's workout items for a given date.
 *
 * Tries the athlete-side daily workout endpoint.
 * Any non-2xx response (including 404 = no workout today) is treated as
 * "no workout assigned" rather than a hard error — the planner should
 * never crash just because there's no workout today.
 *
 * Returns an array of workout block objects (may be empty).
 */
async function fetchWorkoutBlocks(dateISO, signal) {
  const qs = new URLSearchParams({ date: dateISO });

  // Try the athlete daily endpoint — adjust this path if your project
  // uses a different route (e.g. /api/athlete/workouts/day)
  let res;
  try {
    res = await fetch(`/api/athlete/workouts/day?${qs}`, {
      credentials: "include",
      signal,
    });
  } catch (e) {
    // Network error or aborted — treat as no workout
    if (e?.name === "AbortError") throw e;
    return [];
  }

  // 404 = no workout assigned for this date — totally normal
  // Any other non-ok status = soft fail, show empty placeholder
  if (!res.ok) return [];

  const data = await safeJson(res);

  // Shape: { workout: { id, Title }, items: [{ id, Name, sets, reps, ... }] }
  // OR:    { dailyWorkout: {...}, items: [...] }
  const workout = data?.workout ?? data?.dailyWorkout ?? null;
  const items   = Array.isArray(data?.items) ? data.items : [];

  if (!workout && items.length === 0) return [];

  // Map individual exercise items to blocks
  if (items.length > 0) {
    return items.map((item, i) => ({
      id:        `workout-${item.id || i}`,
      type:      "workout",
      label:     String(item.Name || item.name || item.Title || item.title || `Exercise ${i + 1}`),
      time:      workout?.scheduledTime || workout?.ScheduledTime || "4:00 PM",
      subtitle:  buildWorkoutSubtitle(item),
      done:      false,
      itemRef:   item.id,
      workoutId: workout?.id,
    }));
  }

  // Fallback: one block for the whole session
  return [{
    id:        `workout-${workout.id || "main"}`,
    type:      "workout",
    label:     String(workout.Title || workout.title || "Today's Workout"),
    time:      workout.scheduledTime || workout.ScheduledTime || "4:00 PM",
    subtitle:  items.length > 0 ? `${items.length} exercises` : (data?.itemCount ? `${data.itemCount} exercises` : null),
    done:      false,
    workoutId: workout.id,
  }];
}

function safeTarget(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function buildWorkoutSubtitle(item) {
  const parts = [];
  if (item.sets)  parts.push(`${item.sets} sets`);
  if (item.reps)  parts.push(`${item.reps} reps`);
  if (item.weight) parts.push(`${item.weight} lbs`);
  return parts.join(" · ") || null;
}

/**
 * Fetch athlete's nutrition plan for a given date.
 * Returns the completion shape + plan metadata.
 */
async function fetchNutritionData(dateISO, signal) {
  const qs  = new URLSearchParams({ date: dateISO });
  const res = await fetch(`/api/athlete/nutrition/today?${qs}`, {
    credentials: "include",
    signal,
  });

  // 404 = no plan assigned, 401 = not authenticated yet — both are soft failures
  if (!res.ok) return null;

  const data = await safeJson(res);
  return data ?? null;
}

/* ─── Main hook ──────────────────────────────────────────────────────────── */

/**
 * @param {{
 *   authReady: boolean,
 *   user: object,
 *   isAthlete: boolean,
 * }} options
 */
export function useDayPlanner({ authReady, user, isAthlete }) {
  /* ── Date ─────────────────────────────────────────────────────────────── */
  const [dateISO, setDateISO] = useState(todayISO());
  const dow = new Date(dateISO + "T12:00:00").getDay(); // 0=Sun … 6=Sat

  /* ── Classes (localStorage) ───────────────────────────────────────────── */
  const athleteToken = String(user?.AthleteToken || user?.athleteToken || "anon");
  const { classes, addClass, deleteClass, classesForDow } = useDayPlannerClasses({ athleteToken });

  /* ── Done state (per date, localStorage) ─────────────────────────────── */
  const doneKey = `checkpeak:day-done:${athleteToken}:${dateISO}`;
  const [doneIds, setDoneIds] = useState(() => lsGet(doneKey) || []);

  useEffect(() => {
    setDoneIds(lsGet(doneKey) || []);
  }, [doneKey]);

  useEffect(() => {
    lsSet(doneKey, doneIds);
  }, [doneIds, doneKey]);

  const toggleDone = useCallback((id) => {
    setDoneIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  /* ── Remote data ──────────────────────────────────────────────────────── */
  const [workoutBlocks,   setWorkoutBlocks]   = useState([]);
  const [nutritionData,   setNutritionData]   = useState(null);
  const [workoutLoading,  setWorkoutLoading]  = useState(false);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [workoutError,    setWorkoutError]    = useState(null);
  const [nutritionError,  setNutritionError]  = useState(null);

  const enabled = Boolean(authReady && user && isAthlete);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();

    // Workouts — 404 / any failure = "no workout today", never an error banner
    setWorkoutLoading(true);
    setWorkoutError(null);
    fetchWorkoutBlocks(dateISO, controller.signal)
      .then(blocks => { if (!controller.signal.aborted) setWorkoutBlocks(blocks); })
      .catch(e => {
        if (controller.signal.aborted || e?.name === "AbortError") return;
        console.warn("[useDayPlanner] workout fetch:", e?.message);
        if (!controller.signal.aborted) setWorkoutBlocks([]);
      })
      .finally(() => { if (!controller.signal.aborted) setWorkoutLoading(false); });

    // Nutrition
    setNutritionLoading(true);
    setNutritionError(null);
    fetchNutritionData(dateISO, controller.signal)
      .then(data => { if (!controller.signal.aborted) setNutritionData(data); })
      .catch(e   => { if (!controller.signal.aborted && e?.name !== "AbortError") setNutritionError(e?.message || "Failed to load nutrition"); })
      .finally(() => { if (!controller.signal.aborted) setNutritionLoading(false); });

    return () => controller.abort();
  }, [enabled, dateISO]);

  /* ── Build nutrition completion map ───────────────────────────────────── */
  const completionMap = useMemo(() => {
    // nutritionData?.completion shape: { breakfast: { mealDone, hydrationDone }, ... }
    const c = nutritionData?.completion ?? {};
    return c;
  }, [nutritionData]);

  /* ── Build raw blocks ─────────────────────────────────────────────────── */
  const rawBlocks = useMemo(() => {
    const blocks = [];

    // 1) Workout blocks from Airtable
    if (workoutBlocks.length > 0) {
      blocks.push(...workoutBlocks.map(b => ({
        ...b,
        done: doneIds.includes(b.id),
      })));
    } else if (!workoutLoading) {
      // Placeholder when no workout assigned
      blocks.push({
        id:       "workout-none",
        type:     "workout",
        label:    "No workout assigned today",
        time:     "—",
        subtitle: "Check back with your coach",
        done:     false,
        empty:    true,
      });
    }

    // 2) Nutrition blocks — one per meal, with full plan detail for the expandable panel
    const latestPlan  = nutritionData?.latestPlan ?? null;
    const planJson    = latestPlan?.planJson       ?? null;
    const daily       = latestPlan?.daily          ?? {};
    // mealBlocks shape: { breakfast: { targets:{calories,protein,carbs,fat}, diningHallRules, homeExamples }, ... }
    const mealBlocks  = planJson?.mealBlocks       ?? {};
    // Per-meal hydration = total hydrationOz / 4 meals
    const totalHydOz  = Number(daily.hydrationOz || 0);
    const perMealHydOz = totalHydOz > 0 ? Math.round(totalHydOz / 4) : null;
    const coachNote   = planJson?.coachNotes ?? planJson?.notes ?? latestPlan?.prescription ?? null;

    MEAL_BLOCKS.forEach(meal => {
      const blockId   = `nutrition-${meal.id}`;
      const mealComp  = completionMap?.[meal.id] || {};
      const mealDone  = Boolean(mealComp.mealDone);
      const hydDone   = Boolean(mealComp.hydrationDone);
      const subDone   = (mealDone ? 1 : 0) + (hydDone ? 1 : 0);
      const subTotal  = 2;

      // Meal-level block from planJson (has per-meal macros + notes)
      const mealBlock = mealBlocks?.[meal.id] ?? null;
      const targets   = mealBlock?.targets ?? {};

      // Fall back to daily / 4 if no per-meal targets set
      const resolvedTargets = {
        calories: safeTarget(targets.calories) ?? (daily.calories ? Math.round(Number(daily.calories) / 4) : null),
        protein:  safeTarget(targets.protein)  ?? (daily.protein  ? Math.round(Number(daily.protein)  / 4) : null),
        carbs:    safeTarget(targets.carbs)    ?? (daily.carbs    ? Math.round(Number(daily.carbs)    / 4) : null),
        fat:      safeTarget(targets.fat)      ?? (daily.fat      ? Math.round(Number(daily.fat)      / 4) : null),
      };

      blocks.push({
        id:           blockId,
        type:         "nutrition",
        label:        meal.label,
        time:         meal.time,
        subtitle:     buildNutritionSubtitle(meal.id, latestPlan),
        done:         doneIds.includes(blockId) || (mealDone && hydDone),
        subDone,
        subTotal,
        mealDone,
        hydDone,
        mealId:       meal.id,
        hasPlan:      Boolean(latestPlan),
        // Detail panel data
        mealTargets:  resolvedTargets,
        hydrationOz:  perMealHydOz,
        diningNotes:  mealBlock?.diningHallRules ?? null,
        homeExamples: mealBlock?.homeExamples    ?? null,
        coachNote:    coachNote                  ?? null,
      });
    });

    // 3) Classes recurring on this day of week
    classesForDow(dow).forEach(cls => {
      blocks.push({
        id:       cls.id,
        type:     "class",
        label:    cls.name,
        time:     cls.time,
        subtitle: cls.room || null,
        done:     doneIds.includes(cls.id),
        classRef: cls.id,
      });
    });

    return blocks;
  }, [workoutBlocks, workoutLoading, completionMap, nutritionData, classesForDow, dow, doneIds]);

  /* ── Order (drag) ─────────────────────────────────────────────────────── */
  const { orderedBlocks, saveOrder } = useDayPlannerOrder({ dateISO, rawBlocks });

  /* ── Counts ───────────────────────────────────────────────────────────── */
  const counts = useMemo(() => ({
    all:       orderedBlocks.length,
    workout:   orderedBlocks.filter(b => b.type === "workout").length,
    nutrition: orderedBlocks.filter(b => b.type === "nutrition").length,
    class:     orderedBlocks.filter(b => b.type === "class").length,
  }), [orderedBlocks]);

  /* ── Date navigation ──────────────────────────────────────────────────── */
  function shiftDate(n) {
    const d = new Date(dateISO + "T12:00:00");
    d.setDate(d.getDate() + n);
    setDateISO(toISODateLocal(d));
  }

  const isLoading = workoutLoading || nutritionLoading;

  /* ── Meal-level completion toggles ────────────────────────────────────── */
  const toggleMealDone = useCallback((mealId) => {
    // Toggle the mealDone flag — treat as done toggle for the overall block
    // The actual Airtable write happens via the existing completion/upsert endpoint
    // For now we mirror it through doneIds optimistically
    const blockId = `nutrition-${mealId}`;
    const mealComp = completionMap?.[mealId] || {};
    const nowDone  = !Boolean(mealComp.mealDone);
    const hydDone  = Boolean(mealComp.hydrationDone);
    // Mark block done when both toggles are on
    if (nowDone && hydDone) {
      setDoneIds(prev => prev.includes(blockId) ? prev : [...prev, blockId]);
    } else {
      setDoneIds(prev => prev.filter(id => id !== blockId));
    }
    // Update local completion map optimistically
    setNutritionData(prev => {
      if (!prev) return prev;
      const comp = { ...(prev.completion ?? {}) };
      comp[mealId] = { ...(comp[mealId] ?? {}), mealDone: nowDone };
      return { ...prev, completion: comp };
    });
  }, [completionMap, setNutritionData]);

  const toggleHydrationDone = useCallback((mealId) => {
    const blockId  = `nutrition-${mealId}`;
    const mealComp = completionMap?.[mealId] || {};
    const mealDone = Boolean(mealComp.mealDone);
    const nowHydDone = !Boolean(mealComp.hydrationDone);
    if (mealDone && nowHydDone) {
      setDoneIds(prev => prev.includes(blockId) ? prev : [...prev, blockId]);
    } else {
      setDoneIds(prev => prev.filter(id => id !== blockId));
    }
    setNutritionData(prev => {
      if (!prev) return prev;
      const comp = { ...(prev.completion ?? {}) };
      comp[mealId] = { ...(comp[mealId] ?? {}), hydrationDone: nowHydDone };
      return { ...prev, completion: comp };
    });
  }, [completionMap, setNutritionData]);

  return {
    // Date
    dateISO, setDateISO, shiftDate, dow,
    // Blocks
    orderedBlocks, saveOrder, counts,
    // Done
    doneIds, toggleDone, toggleMealDone, toggleHydrationDone,
    // Classes
    classes, addClass, deleteClass, classesForDow,
    // State
    isLoading, workoutError, nutritionError,
    // Raw nutrition data (for NutritionCard if needed)
    nutritionData,
  };
}

/* ─── Nutrition subtitle helper ──────────────────────────────────────────── */

function buildNutritionSubtitle(mealId, plan) {
  // plan.daily has { calories, protein, carbs, fat, hydrationOz }
  const d = plan?.daily || plan || {};
  if (mealId === "breakfast" || mealId === "lunch" || mealId === "dinner") {
    const cal = d.calories ? `~${Math.round(Number(d.calories) / 4)} cal` : null;
    const pro = d.protein  ? `${Math.round(Number(d.protein) / 4)}g protein` : null;
    return [cal, pro].filter(Boolean).join(" · ") || null;
  }
  if (mealId === "afternoon") {
    return d.hydrationOz ? `${Math.round(Number(d.hydrationOz) / 4)} oz water` : null;
  }
  return null;
}