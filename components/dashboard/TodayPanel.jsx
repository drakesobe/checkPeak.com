// /components/dashboard/TodayPanel.jsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { CalendarDays, Utensils, ChevronRight, Dumbbell, Droplets } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

const BRAND     = "#5B9EC9";
const FONT_COND = "'Barlow Condensed', sans-serif";
const FONT_BODY = "'Barlow', sans-serif";

/* -------------------------------------------------------------------------- */
/* Nutrition helpers — all logic preserved                                     */
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

function getMealCompletionDetail(completion) {
  const meals = [
    { key: "breakfast",  label: "AM"   },
    { key: "lunch",      label: "Noon" },
    { key: "afternoon",  label: "PM"   },
    { key: "dinner",     label: "Eve"  },
  ];
  return meals.map(({ key, label }) => ({
    label,
    mealDone:      !!(completion?.[key]?.mealDone),
    hydrationDone: !!(completion?.[key]?.hydrationDone),
  }));
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

/* -------------------------------------------------------------------------- */
/* RingProgress — SVG circular progress, used for workout                     */
/* -------------------------------------------------------------------------- */

function RingProgress({ pct, size = 80, strokeWidth = 7, children }) {
  const r            = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset        = circumference * (1 - clampPct(pct) / 100);
  const center        = size / 2;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {/* Track */}
        <circle
          cx={center} cy={center} r={r}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={center} cy={center} r={r}
          fill="none"
          stroke={pct === 100 ? BRAND : `url(#ringGrad)`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={BRAND} />
            <stop offset="100%" stopColor="#93c5e8" />
          </linearGradient>
        </defs>
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MacroBar — horizontal bar showing a macro value with a label               */
/* -------------------------------------------------------------------------- */

function MacroBar({ label, value, unit, color }) {
  if (value == null) return null;
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-1 h-7 rounded-full shrink-0"
        style={{ background: color }}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p
          className="text-lg font-black leading-none tabular-nums"
          style={{ color: "#0f172a", fontFamily: FONT_COND }}
        >
          {value}
          <span className="text-xs font-bold ml-0.5" style={{ color: "#64748b" }}>{unit}</span>
        </p>
        <p
          className="text-[11px] font-bold uppercase tracking-widest mt-0.5"
          style={{ color: "#64748b", fontFamily: FONT_COND }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MealRow — shows one meal slot's food + hydration status                   */
/* -------------------------------------------------------------------------- */

function MealRow({ label, mealDone, hydrationDone }) {
  return (
    <div className="flex items-center gap-2">
      {/* Meal dot */}
      <div
        className="flex items-center gap-1"
        title={`${label} meal`}
      >
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0 transition-all"
          style={{
            background: mealDone ? BRAND : "#e2e8f0",
            boxShadow:  mealDone ? `0 0 4px rgba(91,158,201,0.5)` : "none",
          }}
        />
      </div>
      {/* Hydration drop */}
      <div
        className="flex items-center gap-1"
        title={`${label} hydration`}
      >
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0 transition-all"
          style={{
            background: hydrationDone ? "#38bdf8" : "#e2e8f0",
            boxShadow:  hydrationDone ? "0 0 4px rgba(56,189,248,0.5)" : "none",
          }}
        />
      </div>
      {/* Label */}
      <p
        className="text-[11px] font-bold uppercase tracking-widest"
        style={{ color: (mealDone && hydrationDone) ? "#334155" : "#64748b", fontFamily: FONT_COND }}
      >
        {label}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* StatusBadge                                                                 */
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
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold shrink-0"
      style={{ fontFamily: FONT_COND, letterSpacing: "0.05em", ...(styles[tone] ?? styles.neutral) }}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* WorkoutZone                                                                 */
/* -------------------------------------------------------------------------- */

function WorkoutZone({ loading, summary }) {
  const itemsCount     = summary?.itemsCount     ?? 0;
  const completedCount = summary?.completedCount ?? 0;

  const hasWork   = !!summary?.hasWorkout || !!summary?.title || itemsCount > 0;
  const pct       = itemsCount > 0 ? Math.round((completedCount / itemsCount) * 100) : 0;
  const isAllDone = itemsCount > 0 && completedCount >= itemsCount;

  const badgeTone  = loading ? "neutral" : hasWork ? (isAllDone ? "done" : "assigned") : "neutral";
  const badgeLabel = loading ? "—" : hasWork ? (isAllDone ? "Complete ✓" : "Assigned") : "None";

  return (
    <div className="flex flex-col h-full">

      {/* Zone eyebrow */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(91,158,201,0.1)", border: "1px solid rgba(91,158,201,0.2)" }}
        >
          <Dumbbell className="w-3.5 h-3.5" style={{ color: BRAND }} aria-hidden="true" />
        </div>
        <p
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: "#64748b", fontFamily: FONT_COND }}
        >
          Workout
        </p>
        <StatusBadge tone={badgeTone}>{badgeLabel}</StatusBadge>
      </div>

      {loading ? (
        /* Loading skeleton */
        <div className="flex-1 space-y-3 animate-pulse">
          <div className="h-4 rounded-full bg-slate-100 w-2/3" />
          <div className="h-20 w-20 rounded-full bg-slate-100" />
          <div className="h-3 rounded-full bg-slate-100 w-1/2" />
        </div>
      ) : hasWork ? (
        <div className="flex-1 flex flex-col gap-4">

          {/* Title */}
          <h3
            className="text-xl font-black leading-tight"
            style={{ color: "#0f172a", fontFamily: FONT_COND }}
          >
            {summary?.title || "Daily Workout"}
          </h3>

          {/* Ring + stats side by side */}
          <div className="flex items-center gap-5">
            <RingProgress pct={pct} size={84} strokeWidth={7}>
              <span
                className="text-xl font-black tabular-nums leading-none"
                style={{ color: isAllDone ? BRAND : "#0f172a", fontFamily: FONT_COND }}
              >
                {pct}
              </span>
              <span
                className="text-[11px] font-bold"
                style={{ color: "#64748b", fontFamily: FONT_COND }}
              >
                %
              </span>
            </RingProgress>

            <div className="space-y-2">
              <div>
                <p
                  className="text-2xl font-black leading-none tabular-nums"
                  style={{ color: "#0f172a", fontFamily: FONT_COND }}
                >
                  {completedCount}
                  <span className="text-base font-semibold" style={{ color: "#64748b" }}>
                    /{itemsCount}
                  </span>
                </p>
                <p
                  className="text-[11px] font-bold uppercase tracking-widest mt-0.5"
                  style={{ color: "#64748b", fontFamily: FONT_COND }}
                >
                  Items done
                </p>
              </div>

              {summary?.status && (
                <p className="text-xs leading-snug" style={{ color: "#64748b" }}>
                  {summary.status}
                </p>
              )}
            </div>
          </div>

          {/* Motivational footer */}
          <p
            className="mt-auto text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "#94a3b8", fontFamily: FONT_COND }}
          >
            {isAllDone ? "Workout complete — great session 💪" : "Coach schedules · You execute"}
          </p>
        </div>
      ) : (
        /* Empty state */
        <div className="flex-1 flex flex-col justify-between">
          <div
            className="rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2"
            style={{ background: "#f8fafc", border: "1px dashed #e2e8f0", minHeight: 100 }}
          >
            <CalendarDays className="w-6 h-6" style={{ color: "#94a3b8" }} aria-hidden="true" />
            <p className="text-sm font-semibold" style={{ color: "#64748b" }}>
              No workout scheduled
            </p>
            <p className="text-xs" style={{ color: "#64748b" }}>
              Check back after your coach updates the schedule.
            </p>
          </div>
          <p
            className="mt-4 text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "#94a3b8", fontFamily: FONT_COND }}
          >
            Rest days matter too
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* NutritionZone                                                               */
/* -------------------------------------------------------------------------- */

function NutritionZone({ loading, planPayload, completionPayload }) {
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
    if (completion && typeof completion === "object") return computeNutritionCounts(completion);
    return { done: 0, total: 0, pct: 0 };
  }, [completion]);

  const mealDetail = useMemo(() => getMealCompletionDetail(completion), [completion]);

  const hasNutritionPlan = !!planPayload?.latestPlan;
  const hasNutrition     = hasNutritionPlan || counts.total > 0 || hasAnyTargets;
  const isComplete       = counts.total > 0 && counts.done >= counts.total;

  const badgeTone  = loading ? "neutral" : !hasNutrition ? "neutral" : isComplete ? "done" : "inProgress";
  const badgeLabel = loading ? "—" : !hasNutrition ? "None" : isComplete ? "Complete ✓" : "In progress";

  return (
    <div className="flex flex-col h-full">

      {/* Zone eyebrow */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(91,158,201,0.1)", border: "1px solid rgba(91,158,201,0.2)" }}
        >
          <Utensils className="w-3.5 h-3.5" style={{ color: BRAND }} aria-hidden="true" />
        </div>
        <p
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: "#64748b", fontFamily: FONT_COND }}
        >
          Nutrition
        </p>
        <StatusBadge tone={badgeTone}>{badgeLabel}</StatusBadge>
      </div>

      {loading ? (
        <div className="flex-1 space-y-3 animate-pulse">
          <div className="h-4 rounded-full bg-slate-100 w-1/2" />
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      ) : !hasNutrition ? (
        /* Empty state */
        <div className="flex-1 flex flex-col justify-between">
          <div
            className="rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2"
            style={{ background: "#f8fafc", border: "1px dashed #e2e8f0", minHeight: 100 }}
          >
            <Utensils className="w-6 h-6" style={{ color: "#94a3b8" }} aria-hidden="true" />
            <p className="text-sm font-semibold" style={{ color: "#64748b" }}>
              No nutrition plan yet
            </p>
            <p className="text-xs" style={{ color: "#64748b" }}>
              Your coach will assign a plan when ready.
            </p>
          </div>
          <p
            className="mt-4 text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "#94a3b8", fontFamily: FONT_COND }}
          >
            Fuelled right · Perform better
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-4">

          {/* Title */}
          <h3
            className="text-xl font-black leading-tight"
            style={{ color: "#0f172a", fontFamily: FONT_COND }}
          >
            Today's targets
          </h3>

          {/* Macro list with colored left bars */}
          {hasAnyTargets && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <MacroBar label="Calories" value={calories} unit="kcal" color={BRAND} />
              <MacroBar label="Protein"  value={protein}  unit="g"    color="#f97316" />
              <MacroBar label="Carbs"    value={carbs}    unit="g"    color="#a78bfa" />
              <MacroBar label="Fat"      value={fat}      unit="g"    color="#34d399" />
            </div>
          )}

          {/* Meal completion — visual dot grid */}
          {counts.total > 0 && (
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
            >
              <div className="flex items-center justify-between mb-3">
                <p
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: "#64748b", fontFamily: FONT_COND }}
                >
                  Meal log
                </p>
                <div className="flex items-center gap-3 text-[11px]" style={{ color: "#64748b", fontFamily: FONT_COND }}>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: BRAND }} />
                    Meal
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#38bdf8" }} />
                    Water
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                {mealDetail.map((meal) => (
                  <MealRow
                    key={meal.label}
                    label={meal.label}
                    mealDone={meal.mealDone}
                    hydrationDone={meal.hydrationDone}
                  />
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <div
                  className="flex-1 h-1 rounded-full overflow-hidden"
                  style={{ background: "#e2e8f0" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width:      `${counts.pct}%`,
                      background: isComplete ? BRAND : `linear-gradient(90deg, ${BRAND}, #93c5e8)`,
                    }}
                  />
                </div>
                <span
                  className="text-[11px] font-bold tabular-nums shrink-0"
                  style={{ color: isComplete ? BRAND : "#64748b", fontFamily: FONT_COND }}
                >
                  {counts.done}/{counts.total}
                </span>
              </div>
            </div>
          )}

          {counts.total === 0 && hasNutrition && (
            <p className="text-xs" style={{ color: "#64748b" }}>
              Open Today to start logging meals.
            </p>
          )}

          {/* Footer */}
          <p
            className="mt-auto text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "#94a3b8", fontFamily: FONT_COND }}
          >
            {isComplete ? "Nutrition complete — well fuelled 🥗" : "Fuelled right · Perform better"}
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TodayPanel                                                                  */
/* -------------------------------------------------------------------------- */

export default function TodayPanel({ loading: workoutLoading = false, summary, onOpen }) {
  const router = useRouter();

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
      setPlanPayload(planRes.ok         ? planJson       : null);
      setCompletionPayload(completionRes.ok ? completionJson : null);
    } catch {
      setPlanPayload(null);
      setCompletionPayload(null);
    } finally {
      setNutLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchNutrition(); }, [fetchNutrition]);

  const handleOpen = () => {
    if (typeof onOpen === "function") onOpen();
    else router.push(`/athlete/today?date=${encodeURIComponent(date)}`);
  };

  return (
    <section
      aria-label="Today's plan"
      style={{
        background:   "#fff",
        border:       "1px solid #e2e8f0",
        borderTop:    `3px solid ${BRAND}`,
        borderRadius: "16px",
        boxShadow:    "0 2px 12px rgba(0,0,0,0.07)",
        fontFamily:   FONT_BODY,
        overflow:     "hidden",
      }}
    >
      {/* ── Panel header ──────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid #f1f5f9" }}
      >
        <div className="flex items-center gap-3">
          {/* Glowing dot */}
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: BRAND, boxShadow: "0 0 0 3px rgba(91,158,201,0.15), 0 0 8px rgba(91,158,201,0.4)" }}
            aria-hidden="true"
          />
          <div>
            <p
              className="text-sm font-black uppercase tracking-widest leading-none"
              style={{ color: "#0f172a", fontFamily: FONT_COND }}
            >
              Today's Plan
            </p>
            <p
              className="text-[11px] mt-0.5 leading-none font-medium"
              style={{ color: "#64748b" }}
            >
              {todayLabel()}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-1.5 rounded-xl text-sm font-bold transition-all"
          style={{
            background:    BRAND,
            color:         "#fff",
            padding:       "9px 18px",
            fontFamily:    FONT_COND,
            letterSpacing: "0.06em",
            boxShadow:     "0 2px 8px rgba(91,158,201,0.3)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#4a8ab5";
            e.currentTarget.style.boxShadow  = "0 4px 16px rgba(91,158,201,0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = BRAND;
            e.currentTarget.style.boxShadow  = "0 2px 8px rgba(91,158,201,0.3)";
          }}
          aria-label="Open today's full plan"
        >
          Open Today
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* ── Two-column body ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
        <div className="p-5 lg:p-6">
          <WorkoutZone loading={workoutLoading} summary={summary} />
        </div>
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