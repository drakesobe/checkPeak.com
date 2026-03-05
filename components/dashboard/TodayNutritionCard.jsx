// /components/dashboard/TodayNutritionCard.jsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { Utensils, ChevronRight } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

const BRAND     = "#5B9EC9";
const FONT_COND = "'Barlow Condensed', sans-serif";
const FONT_BODY = "'Barlow', sans-serif";

/* -------------------------------------------------------------------------- */
/* Pure helpers — unchanged from original                                     */
/* -------------------------------------------------------------------------- */

function nyDateISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year:  "numeric",
    month: "2-digit",
    day:   "2-digit",
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
  const keys  = ["breakfast", "lunch", "afternoon", "dinner"];
  const total = keys.length * 2;
  let done    = 0;
  for (const k of keys) {
    const row = completion?.[k] || {};
    if (row?.mealDone)      done += 1;
    if (row?.hydrationDone) done += 1;
  }
  const pct = total ? clampPct(Math.round((done / total) * 100)) : 0;
  return { done, total, pct };
}

/* -------------------------------------------------------------------------- */
/* ProgressBar                                                                 */
/* -------------------------------------------------------------------------- */

function ProgressBar({ pct }) {
  const w = clampPct(pct);
  return (
    <div
      className="h-1.5 w-full rounded-full overflow-hidden"
      style={{ background: "#e2e8f0" }}
      role="progressbar"
      aria-valuenow={w}
      aria-valuemin={0}
      aria-valuemax={100}
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

/* -------------------------------------------------------------------------- */
/* StatusBadge                                                                 */
/* -------------------------------------------------------------------------- */

function StatusBadge({ children, tone = "neutral" }) {
  const styles = {
    neutral:    { background: "#f8fafc",                    border: "1px solid #e2e8f0",              color: "#64748b" },
    inProgress: { background: "rgba(245,158,11,0.08)",      border: "1px solid rgba(245,158,11,0.25)", color: "#b45309" },
    done:       { background: "rgba(91,158,201,0.08)",      border: "1px solid rgba(91,158,201,0.25)", color: "#1e6fa3" },
  };
  const s = styles[tone] ?? styles.neutral;
  return (
    <span
      className="ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ fontFamily: FONT_COND, letterSpacing: "0.05em", ...s }}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* MacroChip                                                                   */
/* -------------------------------------------------------------------------- */

function MacroChip({ label, value, unit }) {
  if (value == null) return null;
  return (
    <div
      className="flex flex-col items-center px-2.5 py-1.5 rounded-lg"
      style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
    >
      <span
        className="text-sm font-black leading-none"
        style={{ color: "#0f172a", fontFamily: FONT_COND }}
      >
        {value}
        <span className="text-[10px] font-semibold" style={{ color: "#64748b" }}>{unit}</span>
      </span>
      <span
        className="text-[10px] font-bold uppercase tracking-widest mt-0.5"
        style={{ color: "#64748b", fontFamily: FONT_COND }}
      >
        {label}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TodayNutritionCard                                                          */
/* -------------------------------------------------------------------------- */

export default function TodayNutritionCard({ className = "" }) {
  const router = useRouter();

  const [loading,           setLoading]           = useState(true);
  const [planPayload,       setPlanPayload]       = useState(null);
  const [completionPayload, setCompletionPayload] = useState(null);

  const date = useMemo(() => nyDateISO(), []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, completionRes] = await Promise.all([
        fetch(`/api/athlete/nutrition/today?date=${encodeURIComponent(date)}`, {
          method:      "GET",
          headers:     { "Content-Type": "application/json" },
          cache:       "no-store",
          credentials: "include",
        }),
        fetch(`/api/athlete/nutrition/completion/upsert?date=${encodeURIComponent(date)}`, {
          method:      "GET",
          headers:     { "Content-Type": "application/json" },
          cache:       "no-store",
          credentials: "include",
        }),
      ]);

      const planJson       = await planRes.json().catch(() => ({}));
      const completionJson = await completionRes.json().catch(() => ({}));

      setPlanPayload(planRes.ok           ? planJson       : null);
      setCompletionPayload(completionRes.ok ? completionJson : null);
    } catch {
      setPlanPayload(null);
      setCompletionPayload(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Derived values — unchanged logic ── */
  const daily = useMemo(() => {
    const lp = planPayload?.latestPlan || null;
    const d  = lp?.planJson?.daily || lp?.daily || null;
    return d || null;
  }, [planPayload]);

  const calories = fmtNum(daily?.calories);
  const protein  = fmtNum(daily?.protein);
  const carbs    = fmtNum(daily?.carbs);
  const fat      = fmtNum(daily?.fat);

  const hasAnyTargets  = calories != null || protein != null || carbs != null || fat != null;
  const completion     = completionPayload?.completion || null;

  const counts = useMemo(() => {
    if (completion && typeof completion === "object") {
      return computeNutritionCountsFromCompletion(completion);
    }
    return { done: 0, total: 0, pct: 0 };
  }, [completion]);

  const hasNutritionPlan = !!planPayload?.latestPlan;
  const hasNutrition     = hasNutritionPlan || counts.total > 0 || hasAnyTargets;
  const isComplete       = counts.total > 0 && counts.done >= counts.total;

  const goToToday = () => {
    router.push(`/athlete/today?date=${encodeURIComponent(date)}#nutrition`);
  };

  /* ── Status badge tone ── */
  const badgeTone = loading
    ? "neutral"
    : !hasNutrition
    ? "neutral"
    : isComplete
    ? "done"
    : "inProgress";

  const badgeLabel = loading
    ? "Loading"
    : !hasNutrition
    ? "None"
    : isComplete
    ? "Complete"
    : "In progress";

  return (
    <section
      className={`rounded-2xl p-4 sm:p-5 ${className}`}
      style={{
        background: "#fff",
        border:     "1px solid #e2e8f0",
        boxShadow:  "0 1px 4px rgba(0,0,0,0.06)",
        fontFamily: FONT_BODY,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">

          {/* ── Header row ── */}
          <div className="flex items-center gap-1.5 mb-1">
            <Utensils
              className="w-4 h-4 shrink-0"
              style={{ color: BRAND }}
              aria-hidden="true"
            />
            <p
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "#64748b", fontFamily: FONT_COND }}
            >
              Nutrition
            </p>
            <StatusBadge tone={badgeTone}>{badgeLabel}</StatusBadge>
          </div>

          {/* ── Title ── */}
          <h2
            className="text-base sm:text-lg font-black leading-tight"
            style={{ color: "#0f172a", fontFamily: FONT_COND }}
          >
            Today's targets
          </h2>

          {/* ── Body ── */}
          {loading ? (
            <p className="mt-1.5 text-sm" style={{ color: "#64748b" }}>
              Loading nutrition…
            </p>
          ) : !hasNutrition ? (
            <p className="mt-1.5 text-sm" style={{ color: "#64748b" }}>
              No plan assigned yet.
            </p>
          ) : (
            <div className="mt-2 space-y-3">

              {/* Completion progress */}
              {counts.total > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: "#64748b" }}>
                      <span className="font-bold" style={{ color: "#334155" }}>{counts.done}</span>
                      /{counts.total} checks
                    </span>
                    <span
                      className="text-[11px] font-bold tabular-nums"
                      style={{ color: isComplete ? BRAND : "#64748b" }}
                    >
                      {Math.round(counts.pct)}%
                    </span>
                  </div>
                  <ProgressBar pct={counts.pct} />
                  <p className="text-[10px]" style={{ color: "#64748b", fontFamily: FONT_COND, letterSpacing: "0.04em" }}>
                    4 MEALS × MEAL + HYDRATION
                  </p>
                </div>
              )}

              {counts.total === 0 && (
                <p className="text-xs" style={{ color: "#64748b" }}>
                  Open Today to check off meals.
                </p>
              )}

              {/* Macro chips — replaces the plain text one-liner */}
              {hasAnyTargets && (
                <div className="flex flex-wrap gap-1.5">
                  <MacroChip label="Kcal"    value={calories} unit=""  />
                  <MacroChip label="Protein" value={protein}  unit="g" />
                  <MacroChip label="Carbs"   value={carbs}    unit="g" />
                  <MacroChip label="Fat"     value={fat}      unit="g" />
                </div>
              )}

              {!hasAnyTargets && (
                <p className="text-xs" style={{ color: "#64748b" }}>
                  Targets loaded. Open Today to view details.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── CTA ── */}
        <button
          type="button"
          onClick={goToToday}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl text-sm font-bold transition-all"
          style={{
            background:    BRAND,
            color:         "#fff",
            padding:       "8px 14px",
            fontFamily:    FONT_COND,
            letterSpacing: "0.05em",
            boxShadow:     "0 2px 8px rgba(91,158,201,0.28)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#4a8ab5";
            e.currentTarget.style.boxShadow  = "0 4px 12px rgba(91,158,201,0.38)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = BRAND;
            e.currentTarget.style.boxShadow  = "0 2px 8px rgba(91,158,201,0.28)";
          }}
          aria-label="Open today's nutrition plan"
        >
          Open
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}