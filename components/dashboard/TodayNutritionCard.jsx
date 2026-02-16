// components/TodayNutritionCard.jsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { Utensils, ChevronRight } from "lucide-react";

/* ---------------- small helpers ---------------- */

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function nyDateISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function fmtNum(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function computeNutritionCountsFromCompletion(completion) {
  const keys = ["breakfast", "lunch", "afternoon", "dinner"];
  const total = keys.length * 2; // meal + hydration per meal

  let done = 0;
  for (const k of keys) {
    const row = completion?.[k] || {};
    if (row?.mealDone) done += 1;
    if (row?.hydrationDone) done += 1;
  }

  const pct = total ? clampPct(Math.round((done / total) * 100)) : 0;
  return { done, total, pct };
}

function ProgressBar({ pctValue }) {
  const w = clampPct(pctValue);
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

/* ---------------- main ---------------- */

export default function TodayNutritionCard({ className = "" }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  // plan/macros payload
  const [planPayload, setPlanPayload] = useState(null);

  // completion payload
  const [completionPayload, setCompletionPayload] = useState(null);

  const date = useMemo(() => nyDateISO(), []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, completionRes] = await Promise.all([
        fetch(`/api/athlete/nutrition/today?date=${encodeURIComponent(date)}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          credentials: "include",
        }),
        fetch(`/api/athlete/nutrition/completion/upsert?date=${encodeURIComponent(date)}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          credentials: "include",
        }),
      ]);

      const planJson = await planRes.json().catch(() => ({}));
      const completionJson = await completionRes.json().catch(() => ({}));

      setPlanPayload(planRes.ok ? planJson : null);
      setCompletionPayload(completionRes.ok ? completionJson : null);
    } catch {
      setPlanPayload(null);
      setCompletionPayload(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ---- macros from plan endpoint ----
  // Your /api/athlete/nutrition/today returns { latestPlan: { daily: { calories, protein, carbs, fat }, planJson } }
  const daily = useMemo(() => {
    const lp = planPayload?.latestPlan || null;
    const d = lp?.planJson?.daily || lp?.daily || null;
    return d || null;
  }, [planPayload]);

  const calories = fmtNum(daily?.calories);
  const protein = fmtNum(daily?.protein);
  const carbs = fmtNum(daily?.carbs);
  const fat = fmtNum(daily?.fat);

  const hasAnyTargets = calories != null || protein != null || carbs != null || fat != null;

  // ---- completion from completion endpoint ----
  const completion = completionPayload?.completion || null;

  const counts = useMemo(() => {
    if (completion && typeof completion === "object") {
      return computeNutritionCountsFromCompletion(completion);
    }
    return { done: 0, total: 0, pct: 0 };
  }, [completion]);

  const hasNutritionPlan = !!planPayload?.latestPlan;
  const hasNutrition = hasNutritionPlan || counts.total > 0 || hasAnyTargets;

  // This is the key: completed means pct=100 AND total>0
  const isComplete = counts.total > 0 && counts.done >= counts.total;

  const goToToday = () => {
    router.push(`/athlete/today?date=${encodeURIComponent(date)}#nutrition`);
  };

  return (
    <section className={cx("bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Utensils className="w-4 h-4 text-blue-700" />
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Nutrition
            </p>

            {loading ? (
              <span className="ml-1 inline-flex items-center rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                Loading
              </span>
            ) : hasNutrition ? (
              <span
                className={cx(
                  "ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  isComplete
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-amber-50 border-amber-200 text-amber-800"
                )}
              >
                {isComplete ? "Completed" : "In progress"}
              </span>
            ) : (
              <span className="ml-1 inline-flex items-center rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                None
              </span>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-semibold text-gray-900">
            Today targets
          </h2>

          {/* Body */}
          {loading ? (
            <p className="mt-1 text-sm text-gray-600">Loading nutrition…</p>
          ) : !hasNutrition ? (
            <p className="mt-1 text-sm text-gray-600">No plan assigned yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {/* Completion */}
              {counts.total > 0 ? (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                    <span>
                      {counts.done}/{counts.total} checks
                    </span>
                    <span>{Math.round(counts.pct)}%</span>
                  </div>
                  <ProgressBar pctValue={counts.pct} />
                </div>
              ) : (
                <p className="text-[12px] text-gray-600">
                  Open Today to check off meals.
                </p>
              )}

              {/* Macro one-liner */}
              {hasAnyTargets ? (
                <p className="text-[12px] text-gray-700">
                  {calories != null ? <span className="font-semibold">{calories}</span> : "—"} kcal •{" "}
                  {protein != null ? <span className="font-semibold">{protein}g</span> : "—"} protein •{" "}
                  {carbs != null ? <span className="font-semibold">{carbs}g</span> : "—"} carbs •{" "}
                  {fat != null ? <span className="font-semibold">{fat}g</span> : "—"} fat
                </p>
              ) : (
                <p className="text-[12px] text-gray-600">
                  Targets loaded. Open Today to view details.
                </p>
              )}

              <p className="text-[11px] text-gray-400">4 meals × (meal + hydration)</p>
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={goToToday}
          className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#46769B] text-white px-4 py-2 text-sm font-semibold hover:brightness-110 transition"
        >
          Open
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}
