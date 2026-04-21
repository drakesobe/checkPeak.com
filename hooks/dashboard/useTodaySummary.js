// /hooks/dashboard/useTodaySummary.js
"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Meal schedule — mirrors today.jsx MEAL_TIMES exactly
// ---------------------------------------------------------------------------
const MEAL_TIMES = {
  breakfast: 7  * 60,
  lunch:     12 * 60,
  afternoon: 15 * 60,
  dinner:    18 * 60 + 30,
};
const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch:     "Lunch",
  afternoon: "Afternoon Snack",
  dinner:    "Dinner",
};

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
const LS_KEY = (email) => `cp_todaySummary:${email}`;

function lsGet(key) {
  try { return typeof window !== "undefined" ? localStorage.getItem(key) : null; } catch { return null; }
}
function lsSet(key, val) {
  try { if (typeof window !== "undefined") localStorage.setItem(key, val); } catch {}
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------
const DEFAULT = {
  hasWorkout:    false,
  title:         "",
  status:        "",
  itemsCount:    0,
  completedCount:0,

  hasClass:      false,
  className:     "",
  classTime:     "",
  classLocation: "",
  classCoach:    "",

  hasMeal:       false,
  mealKey:       "",       // "breakfast" | "lunch" | "afternoon" | "dinner"
  mealName:      "",
  mealTime:      "",       // "12:00 PM"
  mealCalories:  null,
  mealProtein:   null,
  mealCarbs:     null,
  mealFat:       null,
  mealNotes:     "",
};

// ---------------------------------------------------------------------------
// Parse planJson → find next upcoming meal with full macro targets
// ---------------------------------------------------------------------------
function parseNextMeal(latestPlan) {
  if (!latestPlan) return null;

  // planJson contains mealBlocks keyed by breakfast/lunch/afternoon/dinner
  // Try both common shapes the Airtable plan might use
  const planJson   = latestPlan.planJson || null;
  const mealBlocks =
    planJson?.meals      ||
    planJson?.mealBlocks ||
    planJson?.blocks     ||
    null;

  const now        = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Build candidate list of meals sorted by scheduled time
  const candidates = Object.entries(MEAL_TIMES).map(([key, startMin]) => {
    const block   = mealBlocks?.[key] || {};
    const targets = block?.targets || block || {};

    return {
      key,
      startMin,
      name:     block?.name || MEAL_LABELS[key],
      calories: targets?.calories  ?? targets?.cal  ?? latestPlan?.daily?.calories  ?? null,
      protein:  targets?.protein   ?? targets?.pro  ?? latestPlan?.daily?.protein   ?? null,
      carbs:    targets?.carbs     ?? targets?.carb ?? latestPlan?.daily?.carbs     ?? null,
      fat:      targets?.fat                        ?? latestPlan?.daily?.fat       ?? null,
      notes:    block?.notes || block?.coachNotes || "",
    };
  });

  // Next meal = first one whose window hasn't fully passed (give 45 min window)
  const next = candidates.find(m => (m.startMin + 45) > nowMinutes) || candidates[candidates.length - 1];
  if (!next) return null;

  // Format time string
  const h  = Math.floor(next.startMin / 60) % 24;
  const m  = next.startMin % 60;
  const ap = h >= 12 ? "PM" : "AM";
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const timeStr = m === 0 ? `${dh} ${ap}` : `${dh}:${String(m).padStart(2,"0")} ${ap}`;

  return {
    key:         next.key,
    mealName:    next.name,
    mealTime:    timeStr,
    mealCalories:next.calories ? Number(next.calories) : null,
    mealProtein: next.protein  ? Number(next.protein)  : null,
    mealCarbs:   next.carbs    ? Number(next.carbs)    : null,
    mealFat:     next.fat      ? Number(next.fat)      : null,
    mealNotes:   next.notes,
  };
}

// ---------------------------------------------------------------------------
// Find next upcoming class from localStorage cache
// (useClassSchedules writes to cp_classes:{athleteToken})
// ---------------------------------------------------------------------------
function parseNextClass() {
  try {
    if (typeof window === "undefined") return null;

    const cached =
      Object.keys(localStorage)
        .filter(k => k.startsWith("cp_classes:"))
        .map(k => localStorage.getItem(k))
        .find(Boolean) || null;

    if (!cached) return null;
    const schedules = JSON.parse(cached);
    if (!Array.isArray(schedules) || !schedules.length) return null;

    const now        = new Date();
    const todayName  = now.toLocaleDateString("en-US", { weekday: "long"  }).toLowerCase();
    const todayShort = now.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
    const todayNum   = now.getDay();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const shortNames = ["sun","mon","tue","wed","thu","fri","sat"];

    const todayClasses = schedules.filter(s =>
      (Array.isArray(s?.days) ? s.days : []).some(d => {
        const ds = String(d).toLowerCase().trim();
        return ds === todayName || ds === todayShort ||
          (!isNaN(Number(ds)) && Number(ds) === todayNum) ||
          shortNames.indexOf(ds) === todayNum;
      })
    );

    const next = todayClasses
      .filter(s => ((s.startMinutes || 0) + (s.durationMinutes || 60)) > nowMinutes)
      .sort((a, b) => (a.startMinutes || 0) - (b.startMinutes || 0))[0] || null;

    if (!next) return null;

    const h  = Math.floor((next.startMinutes || 0) / 60) % 24;
    const m  = (next.startMinutes || 0) % 60;
    const ap = h >= 12 ? "PM" : "AM";
    const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;

    return {
      className:     String(next.title || next.name || "Class").trim(),
      classTime:     m === 0 ? `${dh} ${ap}` : `${dh}:${String(m).padStart(2,"0")} ${ap}`,
      classLocation: String(next.location || next.room || "").trim(),
      classCoach:    String(next.coach || next.instructor || "").trim(),
    };
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useTodaySummary({ userEmail }) {
  // Seed from localStorage immediately — zero loading flash
  const [todaySummary, setTodaySummary] = useState(() => {
    if (typeof window === "undefined" || !userEmail) return DEFAULT;
    try {
      const raw = lsGet(LS_KEY(userEmail));
      return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
    } catch { return DEFAULT; }
  });

  // Only show loading spinner if we have no cached data at all
  const [loadingToday, setLoadingToday] = useState(() => {
    if (typeof window === "undefined" || !userEmail) return true;
    return !lsGet(LS_KEY(userEmail));
  });

  useEffect(() => {
    if (!userEmail) return;
    let cancelled = false;

    async function loadToday() {
      // Class data is synchronous from localStorage — resolve instantly
      const classData = parseNextClass();

      // Fire workout + nutrition in parallel
      const [workoutResult, nutritionResult] = await Promise.allSettled([
        fetch("/api/athlete/workouts/today", { method: "GET", credentials: "include" }),
        fetch("/api/athlete/nutrition/today", { method: "GET", credentials: "include" }),
      ]);

      if (cancelled) return;

      // ── Workout ────────────────────────────────────────────────────────────
      let hasWorkout     = false;
      let title          = "";
      let status         = "";
      let itemsCount     = 0;
      let completedCount = 0;

      if (workoutResult.status === "fulfilled" && workoutResult.value.ok) {
        try {
          const data  = await workoutResult.value.json();
          const dw    = data?.dailyWorkout || null;
          const items = Array.isArray(data?.items) ? data.items : [];

          completedCount = items.filter(it => {
            const v = it?.Completed;
            if (v === true) return true;
            const s = String(v || "").toLowerCase();
            return s === "true" || s === "1" || s === "yes";
          }).length;

          hasWorkout = !!dw;
          title      = dw?.Title  || dw?.title  || "";
          status     = dw?.Status || dw?.status || "";
          itemsCount = items.length;
        } catch {}
      }

      // ── Nutrition — parse next meal from planJson ──────────────────────────
      let hasMeal      = false;
      let mealKey      = "";
      let mealName     = "";
      let mealTime     = "";
      let mealCalories = null;
      let mealProtein  = null;
      let mealCarbs    = null;
      let mealFat      = null;
      let mealNotes    = "";

      if (nutritionResult.status === "fulfilled" && nutritionResult.value.ok) {
        try {
          const data       = await nutritionResult.value.json();
          const latestPlan = data?.latestPlan || null;
          const nextMeal   = parseNextMeal(latestPlan);

          if (nextMeal) {
            hasMeal      = true;
            mealKey      = nextMeal.key;
            mealName     = nextMeal.mealName;
            mealTime     = nextMeal.mealTime;
            mealCalories = nextMeal.mealCalories;
            mealProtein  = nextMeal.mealProtein;
            mealCarbs    = nextMeal.mealCarbs;
            mealFat      = nextMeal.mealFat;
            mealNotes    = nextMeal.mealNotes;
          }
        } catch {}
      }

      if (cancelled) return;

      const next = {
        hasWorkout, title, status, itemsCount, completedCount,
        hasClass:      !!classData,
        className:     classData?.className     || "",
        classTime:     classData?.classTime     || "",
        classLocation: classData?.classLocation || "",
        classCoach:    classData?.classCoach    || "",
        hasMeal, mealKey, mealName, mealTime,
        mealCalories, mealProtein, mealCarbs, mealFat, mealNotes,
      };

      setTodaySummary(next);
      lsSet(LS_KEY(userEmail), JSON.stringify(next));
    }

    loadToday()
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingToday(false); });

    return () => { cancelled = true; };
  }, [userEmail]);

  return { todaySummary, loadingToday };
}