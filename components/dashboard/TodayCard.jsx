// /components/dashboard/TodayPanel.jsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { CalendarDays, Utensils, ChevronRight } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

const BRAND     = "#5B9EC9";
const FONT_COND = "'Barlow Condensed', sans-serif";
const FONT_BODY = "'Barlow', sans-serif";

/* -------------------------------------------------------------------------- */
/* Nutrition helpers — all logic preserved from TodayNutritionCard            */
/* -------------------------------------------------------------------------- */

function nyDateISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
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

function computeNutritionCounts(completion) {
  const keys  = ["breakfast", "lunch", "afternoon", "dinner"];
  const total = keys.length * 2;
  let done = 0;
  for (const k of keys) {
    const row = completion?.[k] || {};
    if (row?.mealDone)      done += 1;
    if (row?.hydrationDone) done += 1;
  }
  return { done, total, pct: total ? clampPct(Math.round((done / total) * 100)) : 0 };
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

/* -------------------------------------------------------------------------- */
/* Shared sub-components                                                       */
/* -------------------------------------------------------------------------- */

function StatusBadge({ children, tone = "neutral" }) {
  const styles = {
    neutral:    { background: "#f8fafc",               border: "1px solid #e2e8f0",               color: "#64748b" },
    assigned:   { background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", color: "#b45309" },
    inProgress: { background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", color: "#b45309" },
    done:       { background: "rgba(91,158,201,0.08)", border: "1px solid rgba(91,158,201,0.25)", color: "#1e6fa3" },
  };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ fontFamily: FONT_COND, letterSpacing: "0.05em", ...styles[tone] ?? styles.neutral }}
    >
      {children}
    </span>
  );
}

function ProgressBar({ pct, ariaLabel }) {
  const w = clampPct(pct);
  return (
    <div
      className="w-full h-1.5 rounded-full overflow-hidden"
      style={{ background: "#e2e8f0" }}
      role="progressbar"
      aria-valuenow={w}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width:      `${w}%`,
          background: w === 100 ? BRAND : `linear-gradient(90deg, ${BRAND}, #93c5e8)`,
        }}
      />
    </div>
  );
}

/* MacroBlock — the 2×2 grid tile for each macro value */
function MacroBlock({ label, value, unit }) {
  if (value == null) return null;
  return (
    <div className="flex flex-col">
      <span
        className="text-2xl font-black leading-none tabular-nums"
        style={{ color: "#0f172a", fontFamily: FONT_COND }}
      >
        {value}
        <span
          className="text-sm font-bold ml-0.5"
          style={{ color: "#64748b" }}
        >
          {unit}
        </span>
      </span>
      <span
        className="text-[10px] font-bold uppercase tracking-widest mt-1"
        style={{ color: "#64748b", fontFamily: FONT_COND }}
      >
        {label}
      </span>
    </div>
  );
}

/* ZoneLabel — the small caps section eyebrow inside each column */
function ZoneLabel({ icon, children }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <span style={{ color: BRAND }} aria-hidden="true">{icon}</span>
      <p
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "#64748b", fontFamily: FONT_COND }}
      >
        {children}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* WorkoutZone — left column                                                   */
/* -------------------------------------------------------------------------- */

function WorkoutZone({ loading, summary }) {
  const itemsCount     = summary?.itemsCount     ?? 0;
  const completedCount = summary?.completedCount ?? 0;

  const hasWork =
    !!summary?.hasWorkout ||
    !!summary?.title      ||
    itemsCount > 0;

  const pct       = Math.round((completedCount / Math.max(1, itemsCount)) * 100);
  const isAllDone = itemsCount > 0 && completedCount >= itemsCount;

  const badgeTone  = loading ? "neutral" : hasWork ? (isAllDone ? "done" : "assigned") : "neutral";
  const badgeLabel = loading ? "Loading…" : hasWork ? (isAllDone ? "Complete" : "Assigned") : "None";

  return (
    <div className="flex flex-col h-full min-w-0">
      <ZoneLabel icon={<CalendarDays className="w-3.5 h-3.5" />}>Workout</ZoneLabel>

      <div className="flex items-center gap-2 mb-2">
        <h3
          className="text-lg font-black leading-tight"
          style={{ color: "#0f172a", fontFamily: FONT_COND }}
        >
          {loading ? "Loading…" : hasWork ? (summary?.title || "Daily Workout") : "No workout today"}
        </h3>
        <StatusBadge tone={badgeTone}>{badgeLabel}</StatusBadge>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: "#64748b" }}>Loading workout plan…</p>
      ) : hasWork ? (
        <div className="space-y-3 flex-1">
          {/* Item counts */}
          <div className="flex items-baseline gap-3">
            <div className="flex flex-col">
              <span
                className="text-2xl font-black leading-none tabular-nums"
                style={{ color: "#0f172a", fontFamily: FONT_COND }}
              >
                {completedCount}
                <span className="text-sm font-bold ml-0.5" style={{ color: "#64748b" }}>
                  /{itemsCount}
                </span>
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest mt-1"
                style={{ color: "#64748b", fontFamily: FONT_COND }}
              >
                Items done
              </span>
            </div>

            {summary?.status && (
              <span
                className="text-xs leading-snug"
                style={{ color: "#64748b" }}
              >
                {summary.status}
              </span>
            )}
          </div>

          {/* Progress */}
          {itemsCount > 0 && (
            <div className="space-y-1.5">
              <ProgressBar pct={pct} ariaLabel="Workout completion" />
              <p
                className="text-[10px] font-bold tabular-nums"
                style={{ color: isAllDone ? BRAND : "#64748b" }}
              >
                {pct}% complete
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm flex-1" style={{ color: "#64748b" }}>
          No workout assigned yet. Check back after your coach updates the schedule.
        </p>
      )}

      {/* Footer */}
      <p
        className="mt-4 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "#cbd5e1", fontFamily: FONT_COND }}
      >
        Coach schedules · You execute
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* NutritionZone — right column                                               */
/* -------------------------------------------------------------------------- */

function NutritionZone({ loading, planPayload, completionPayload }) {
  /* Derived — same logic as TodayNutritionCard */
  const daily = useMemo(() => {
    const lp = planPayload?.latestPlan || null;
    return lp?.planJson?.daily || lp?.daily || null;
  }, [planPayload]);

  const calories = fmtNum(daily?.calories);
  const protein  = fmtNum(daily?.protein);
  const carbs    = fmtNum(daily?.carbs);
  const fat      = fmtNum(daily?.fat);

  const hasAnyTargets  = calories != null || protein != null || carbs != null || fat != null;
  const completion     = completionPayload?.completion || null;

  const counts = useMemo(() => {
    if (completion && typeof completion === "object") {
      return computeNutritionCounts(completion);
    }
    return { done: 0, total: 0, pct: 0 };
  }, [completion]);

  const hasNutritionPlan = !!planPayload?.latestPlan;
  const hasNutrition     = hasNutritionPlan || counts.total > 0 || hasAnyTargets;
  const isComplete       = counts.total > 0 && counts.done >= counts.total;

  const badgeTone  = loading ? "neutral" : !hasNutrition ? "neutral" : isComplete ? "done" : "inProgress";
  const badgeLabel = loading ? "Loading…" : !hasNutrition ? "None" : isComplete ? "Complete" : "In progress";

  return (
    <div className="flex flex-col h-full min-w-0">
      <ZoneLabel icon={<Utensils className="w-3.5 h-3.5" />}>Nutrition</ZoneLabel>

      <div className="flex items-center gap-2 mb-2">
        <h3
          className="text-lg font-black leading-tight"
          style={{ color: "#0f172a", fontFamily: FONT_COND }}
        >
          Today's targets
        </h3>
        <StatusBadge tone={badgeTone}>{badgeLabel}</StatusBadge>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: "#64748b" }}>Loading nutrition plan…</p>
      ) : !hasNutrition ? (
        <p className="text-sm flex-1" style={{ color: "#64748b" }}>
          No nutrition plan assigned yet.
        </p>
      ) : (
        <div className="flex-1 space-y-4">

          {/* Macro 2×2 grid — the hero element of this zone */}
          {hasAnyTargets && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <MacroBlock label="Kcal"    value={calories} unit=""  />
              <MacroBlock label="Protein" value={protein}  unit="g" />
              <MacroBlock label="Carbs"   value={carbs}    unit="g" />
              <MacroBlock label="Fat"     value={fat}      unit="g" />
            </div>
          )}

          {/* Meal completion */}
          {counts.total > 0 && (
            <div
              className="rounded-xl p-3 space-y-2"
              style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#64748b", fontFamily: FONT_COND }}>
                  Meal completion
                </p>
                <span
                  className="text-[11px] font-bold tabular-nums"
                  style={{ color: isComplete ? BRAND : "#64748b" }}
                >
                  {counts.done}/{counts.total}
                </span>
              </div>
              <ProgressBar pct={counts.pct} ariaLabel="Meal completion" />
              <p className="text-[10px]" style={{ color: "#64748b", fontFamily: FONT_COND, letterSpacing: "0.04em" }}>
                4 meals · meal + hydration each
              </p>
            </div>
          )}

          {counts.total === 0 && (
            <p className="text-xs" style={{ color: "#64748b" }}>
              Open Today to start checking off meals.
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      <p
        className="mt-4 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "#cbd5e1", fontFamily: FONT_COND }}
      >
        Fuelled right · Perform better
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TodayPanel — the unified component                                          */
/* -------------------------------------------------------------------------- */

export default function TodayPanel({ loading: workoutLoading = false, summary, onOpen }) {
  const router = useRouter();

  /* Nutrition data — fetched internally, same as TodayNutritionCard */
  const [nutLoading,        setNutLoading]        = useState(true);
  const [planPayload,       setPlanPayload]       = useState(null);
  const [completionPayload, setCompletionPayload] = useState(null);

  const date = useMemo(() => nyDateISO(), []);

  const fetchNutrition = useCallback(async () => {
    setNutLoading(true);
    try {
      const [planRes, completionRes] = await Promise.all([
        fetch(`/api/athlete/nutrition/today?date=${encodeURIComponent(date)}`, {
          method: "GET", headers: { "Content-Type": "application/json" },
          cache: "no-store", credentials: "include",
        }),
        fetch(`/api/athlete/nutrition/completion/upsert?date=${encodeURIComponent(date)}`, {
          method: "GET", headers: { "Content-Type": "application/json" },
          cache: "no-store", credentials: "include",
        }),
      ]);
      const planJson       = await planRes.json().catch(() => ({}));
      const completionJson = await completionRes.json().catch(() => ({}));
      setPlanPayload(planRes.ok       ? planJson       : null);
      setCompletionPayload(completionRes.ok ? completionJson : null);
    } catch {
      setPlanPayload(null);
      setCompletionPayload(null);
    } finally {
      setNutLoading(false); }
  }, [date]);

  useEffect(() => { fetchNutrition(); }, [fetchNutrition]);

  /* Unified CTA — goes to the Today page anchored to the top */
  const handleOpen = () => {
    if (typeof onOpen === "function") {
      onOpen();
    } else {
      router.push(`/athlete/today?date=${encodeURIComponent(date)}`);
    }
  };

  const loading = workoutLoading || nutLoading;

  return (
    <section
      style={{
        background: "#fff",
        border:     "1px solid #e2e8f0",
        boxShadow:  "0 1px 6px rgba(0,0,0,0.07)",
        borderRadius: "16px",
        fontFamily: FONT_BODY,
        overflow:   "hidden",
      }}
      aria-label="Today's plan"
    >
      {/* ── Panel header ──────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid #f1f5f9" }}
      >
        <div className="flex items-center gap-2.5">
          {/* Live dot */}
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: BRAND, boxShadow: "0 0 6px rgba(91,158,201,0.5)" }}
            aria-hidden="true"
          />
          <div>
            <p
              className="text-xs font-black uppercase tracking-widest leading-none"
              style={{ color: BRAND, fontFamily: FONT_COND }}
            >
              Today
            </p>
            <p
              className="text-[11px] mt-0.5 leading-none"
              style={{ color: "#64748b" }}
            >
              {todayLabel()}
            </p>
          </div>
        </div>

        {/* Single CTA */}
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-1.5 rounded-xl text-sm font-bold transition-all"
          style={{
            background:    BRAND,
            color:         "#fff",
            padding:       "8px 16px",
            fontFamily:    FONT_COND,
            letterSpacing: "0.06em",
            boxShadow:     "0 2px 8px rgba(91,158,201,0.28)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#4a8ab5";
            e.currentTarget.style.boxShadow  = "0 4px 14px rgba(91,158,201,0.38)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = BRAND;
            e.currentTarget.style.boxShadow  = "0 2px 8px rgba(91,158,201,0.28)";
          }}
          aria-label="Open today's full plan"
        >
          Open Today
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* ── Two-column body ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2">

        {/* Left — Workout */}
        <div className="p-5 lg:p-6">
          <WorkoutZone loading={workoutLoading} summary={summary} />
        </div>

        {/* Divider */}
        <div
          className="hidden lg:block w-px self-stretch my-4"
          style={{ background: "#f1f5f9" }}
          aria-hidden="true"
        />
        <div
          className="block lg:hidden mx-5"
          style={{ height: "1px", background: "#f1f5f9" }}
          aria-hidden="true"
        />

        {/* Right — Nutrition */}
        <div className="p-5 lg:p-6">
          <NutritionZone
            loading={nutLoading}
            planPayload={planPayload}
            completionPayload={completionPayload}
          />
        </div>
      </div>
    </section>
  );
}