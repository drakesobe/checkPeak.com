// components/athlete-today/nutrition/sections/NutritionHeader.jsx
"use client";

import { useMemo } from "react";
import { RefreshCcw, ArrowRight, CheckCircle2, Utensils } from "lucide-react";
import { cx, isISODateOnly, fmtHumanDate, pct } from "../helpers";
import ProgressBar from "../ui/ProgressBar";

/**
 * NutritionHeader (polished SaaS)
 * ✅ mobile-safe wrapping (no weird second-line pills)
 * ✅ clear hierarchy + “card” header feel
 * ✅ better button affordance + consistent sizing
 * ✅ progress block reads fast
 */

function TinyChip({ children, tone = "soft", className = "" }) {
  const toneCls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : tone === "blue"
      ? "bg-blue-50 text-blue-900 border-blue-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1",
        "text-[11px] font-semibold leading-none whitespace-nowrap",
        toneCls,
        className
      )}
    >
      {children}
    </span>
  );
}

function ActionButton({ onClick, children, variant = "secondary", title = "" }) {
  const base =
    "inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap";
  const cls =
    variant === "primary"
      ? "bg-[#46769B] text-white hover:brightness-110"
      : "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50";

  return (
    <button type="button" onClick={onClick} title={title} className={cx(base, cls)}>
      {children}
    </button>
  );
}

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export default function NutritionHeader({
  subtitle,
  metaStatus,
  metaEff,
  counts,
  onRefresh,
  onOpenNutrition,
}) {
  const done = Number(counts?.done || 0);
  const total = Number(counts?.total || 0);
  const pctRaw = clampPct(counts?.pct);
  const isComplete = total > 0 && done >= total;

  const progressTone = useMemo(() => {
    if (!total) return "soft";
    if (isComplete) return "ok";
    if (pctRaw >= 50) return "blue";
    return "soft";
  }, [total, isComplete, pctRaw]);

  const progressLabel = useMemo(() => {
    if (!total) return "—";
    return `${done}/${total} complete (${pct(pctRaw)})`;
  }, [done, total, pctRaw]);

  return (
    <div className="flex flex-col gap-3">
      {/* Header card */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* subtle top accent */}
        <div className="h-1 w-full bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-60" />

        <div className="p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            {/* Left */}
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <span className="shrink-0 h-10 w-10 rounded-2xl border border-blue-100 bg-blue-50 flex items-center justify-center">
                  <Utensils className="w-5 h-5 text-[#46769B]" />
                </span>

                <div className="min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 gap-1">
                    <h2 className="text-lg font-extrabold text-gray-900 leading-tight">
                      Nutrition
                    </h2>

                    {/* chips: wrap nicely, never squeeze into ugly 2-line */}
                    <div className="flex flex-wrap items-center gap-2">
                      <TinyChip tone="blue">Suggested</TinyChip>

                      {metaStatus ? <TinyChip tone="soft">{metaStatus}</TinyChip> : null}

                      <TinyChip tone={progressTone}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {progressLabel}
                      </TinyChip>
                    </div>
                  </div>

                  {subtitle ? (
                    <p className="text-sm text-gray-500 mt-2 leading-snug">
                      {subtitle}
                    </p>
                  ) : null}

                  {metaEff && isISODateOnly(metaEff) ? (
                    <p className="text-[11px] text-gray-500 mt-2 leading-none">
                      Plan effective:{" "}
                      <span className="font-semibold text-gray-700">
                        {fmtHumanDate(metaEff)}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Right actions */}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
              <ActionButton onClick={onRefresh} title="Refresh nutrition data">
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </ActionButton>

              <ActionButton
                onClick={onOpenNutrition}
                variant="primary"
                title="Open full nutrition page"
              >
                Open
                <ArrowRight className="w-4 h-4" />
              </ActionButton>
            </div>
          </div>
        </div>
      </div>

      {/* Progress card */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-snug">
              Daily completion
            </p>
            <p className="text-[12px] text-gray-600 mt-1 leading-snug">
              Meal + hydration per meal (swipe right to complete).
            </p>
          </div>

          <TinyChip tone={isComplete ? "ok" : "soft"} className="w-fit">
            {total ? `${pct(pctRaw)} complete` : "No items"}
          </TinyChip>
        </div>

        <div className="mt-3">
          <ProgressBar pctValue={pctRaw} />
        </div>

        {/* Optional microcopy line that doesn’t wreck mobile spacing */}
        {total ? (
          <p className="mt-2 text-[11px] text-gray-500 leading-snug">
            Tip: you’re counting 8 checks total (4 meals × meal + hydration).
          </p>
        ) : null}
      </div>
    </div>
  );
}
