// hooks/athlete-today/useAthleteNutritionToday.js
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

function safeText(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function pickPlanJson(plan) {
  // Your API already returns planJson as an object; keep this defensive anyway.
  const pj = plan?.planJson || plan?.PlanJson || plan?._raw?.planJson || plan?._raw?.PlanJson;
  return pj && typeof pj === "object" ? pj : null;
}

function pickMealBlocks(planJson) {
  const mb = planJson?.mealBlocks;
  return mb && typeof mb === "object" ? mb : null;
}

function isISODateOnly(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function isFutureDate(selectedDate, effectiveDate) {
  if (!isISODateOnly(selectedDate) || !isISODateOnly(effectiveDate)) return false;
  // YYYY-MM-DD strings can be compared lexicographically
  return effectiveDate > selectedDate;
}

/**
 * Hydration normalization
 * - Airtable column: "DailyHydration" (single line text)
 * - UI key: daily.hydrationOz (string)
 * - Also supports PlanJson daily keys (hydrationOz, hydration, dailyHydrationOz)
 */
function pickDailyHydrationOz({ plan, planJson, dailyObj }) {
  // 1) Airtable top-level field (preferred for your table design)
  const fromPlanField =
    safeText(plan?.DailyHydration) ||
    safeText(plan?.dailyHydration) ||
    safeText(plan?.dailyHydrationOz);

  if (fromPlanField) return fromPlanField;

  // 2) Daily object (if API already flattened it)
  const fromDailyObj =
    safeText(dailyObj?.hydrationOz) ||
    safeText(dailyObj?.DailyHydration) ||
    safeText(dailyObj?.dailyHydrationOz) ||
    safeText(dailyObj?.hydration);

  if (fromDailyObj) return fromDailyObj;

  // 3) PlanJson daily fallbacks
  const pjDaily = planJson?.daily && typeof planJson.daily === "object" ? planJson.daily : {};
  const fromPlanJson =
    safeText(pjDaily?.hydrationOz) ||
    safeText(pjDaily?.DailyHydration) ||
    safeText(pjDaily?.dailyHydrationOz) ||
    safeText(pjDaily?.hydration);

  return fromPlanJson;
}

/**
 * Date-aware athlete nutrition hook
 * - Fetches /api/athlete/nutrition/today?date=YYYY-MM-DD
 * - Reads API shape: { latestPlan, nextPlan, selectedDate, message }
 * - Also supports older: { plan }
 */
export function useAthleteNutritionToday({ authReady, user, isAthlete, selectedDate }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // The plan effective for the selected date (or null)
  const [plan, setPlan] = useState(null);

  // If no plan yet, this may exist (upcoming)
  const [nextPlan, setNextPlan] = useState(null);

  // Optional server message like "Next plan starts..."
  const [message, setMessage] = useState("");

  // Keep the server’s selectedDate (in case it falls back to NY today)
  const [serverSelectedDate, setServerSelectedDate] = useState("");

  const reload = useCallback(
    async (dateArg) => {
      if (!authReady) return;
      if (!user) return;
      if (!isAthlete) return;

      const d = isISODateOnly(dateArg) ? dateArg : isISODateOnly(selectedDate) ? selectedDate : "";

      setLoading(true);
      setErr("");

      try {
        const qs = d ? `?date=${encodeURIComponent(d)}` : "";
        const res = await fetch(`/api/athlete/nutrition/today${qs}`, {
          method: "GET",
          credentials: "include",
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to load nutrition plan.");

        // ✅ Support BOTH shapes:
        // new: latestPlan
        // old: plan
        const picked = data?.latestPlan ?? data?.plan ?? null;

        setPlan(picked);
        setNextPlan(data?.nextPlan ?? null);
        setMessage(safeText(data?.message || ""));
        setServerSelectedDate(safeText(data?.selectedDate || d || ""));
      } catch (e) {
        setPlan(null);
        setNextPlan(null);
        setMessage("");
        setServerSelectedDate("");

        setErr(safeText(e?.message) || "Failed to load nutrition plan.");
      } finally {
        setLoading(false);
      }
    },
    [authReady, user, isAthlete, selectedDate]
  );

  useEffect(() => {
    // Load whenever auth is ready AND selectedDate changes
    if (!authReady) return;
    if (!user) return;
    if (!isAthlete) return;

    reload(selectedDate);
  }, [authReady, user, isAthlete, selectedDate, reload]);

  const planJson = useMemo(() => pickPlanJson(plan), [plan]);
  const mealBlocks = useMemo(() => pickMealBlocks(planJson), [planJson]);

  const dailyRaw = useMemo(() => {
    // Prefer PlanJson.daily, fall back to plan.daily from API
    const d = planJson?.daily || plan?.daily || null;
    return d && typeof d === "object" ? d : null;
  }, [planJson, plan]);

  // ✅ Hydration (oz) normalized from Airtable DailyHydration and/or PlanJson
  const dailyHydrationOz = useMemo(() => {
    return pickDailyHydrationOz({ plan, planJson, dailyObj: dailyRaw });
  }, [plan, planJson, dailyRaw]);

  // ✅ Daily object guaranteed to include hydrationOz when available
  const daily = useMemo(() => {
    const d = dailyRaw && typeof dailyRaw === "object" ? dailyRaw : null;
    if (!d) {
      // If there's no daily object but we do have hydration, still return a daily object for UI
      if (dailyHydrationOz) return { hydrationOz: dailyHydrationOz };
      return null;
    }

    // Don’t overwrite if already present
    if (safeText(d?.hydrationOz)) return d;

    // Add hydrationOz if we have it
    if (dailyHydrationOz) return { ...d, hydrationOz: dailyHydrationOz };

    return d;
  }, [dailyRaw, dailyHydrationOz]);

  const effectiveDate = useMemo(() => {
    // You return effectiveDate at top-level on latestPlan
    const eff = safeText(plan?.effectiveDate) || safeText(planJson?.meta?.effectiveDate);
    // If it’s an ISO datetime, reduce to YYYY-MM-DD for UI
    if (/^\d{4}-\d{2}-\d{2}T/.test(eff)) return eff.slice(0, 10);
    return eff;
  }, [plan, planJson]);

  const selectedDateResolved = useMemo(() => {
    // Prefer serverSelectedDate (NY-based) if present
    const d = safeText(serverSelectedDate) || safeText(selectedDate);
    return isISODateOnly(d) ? d : "";
  }, [serverSelectedDate, selectedDate]);

  const dailyHasData = Boolean(
    plan?.daily &&
    (safeText(plan.daily.calories) || safeText(plan.daily.protein) || safeText(plan.daily.hydrationOz))
  );
  const hasPlan = Boolean(plan && (planJson || mealBlocks || safeText(plan?.prescription) || dailyHasData));

  // If no plan effective today but there is a next plan in the future
  const isFuture = useMemo(() => {
    if (hasPlan) return false;

    const nextEff = safeText(nextPlan?.effectiveDate);
    if (!nextEff) return false;

    return isFutureDate(selectedDateResolved, nextEff);
  }, [hasPlan, nextPlan, selectedDateResolved]);

  return {
    loading,
    err,
    setErr,

    // call reload(selectedDate) or reload("YYYY-MM-DD")
    reload,

    // main objects
    hasPlan,
    plan,
    planJson,
    daily, // ✅ now includes hydrationOz when found
    dailyHydrationOz, // ✅ explicit convenience
    mealBlocks,

    // extra context for better UX
    selectedDate: selectedDateResolved,
    effectiveDate,
    nextPlan,
    isFuture,
    message,
  };
}
