// components/athlete-today/nutrition/sections/DailyTargets.jsx
"use client";

import { useMemo } from "react";
import { Droplets, Flame, Target, Zap } from "lucide-react";
import { fmt } from "../helpers";
import TinyPill from "../ui/TinyPill";

/**
 * DailyTargets
 * Visual goals:
 * ✅ Premium “soft SaaS” card (matches MealTargets polish)
 * ✅ No awkward wrapping on mobile (tight labels + truncation + min-w-0)
 * ✅ Strong visual hierarchy (title → hydration pill → macro tiles)
 * ✅ Subtle “primo” touches: top accent bar, gentle gradient wash, micro stats
 *
 * Data notes:
 * - `daily` is expected to carry macros (calories/protein/carbs/fat) in your normalized shape.
 * - `dailyHydrationOz` is passed from page (computed from planJson/daily fallbacks).
 */

function safeNumber(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

/** `fmt` may return "—" for nullish values; we also compute a safe pct for the bar. */
function safePct(done, total) {
  const d = safeNumber(done);
  const t = safeNumber(total);
  if (d == null || t == null || t <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((d / t) * 100)));
}

/** Small KPI tile */
function StatTile({ icon, label, value, unit, tone = "soft" }) {
  const toneCls =
    tone === "blue"
      ? "border-blue-200 bg-blue-50/70"
      : tone === "ok"
      ? "border-emerald-200 bg-emerald-50/70"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50/70"
      : "border-gray-200 bg-gray-50";

  return (
    <div className={`rounded-2xl border p-4 min-w-0 ${toneCls}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500 font-semibold truncate">{label}</p>
        <span className="shrink-0">{icon}</span>
      </div>

      <p className="text-xl font-extrabold text-gray-900 mt-2 truncate">{value}</p>

      <p className="text-[11px] text-gray-500 mt-1 truncate">{unit}</p>
    </div>
  );
}

/** Mini progress bar (purely visual polish; does not assume “completion,” just “daily totals present”) */
function MiniBar({ pct }) {
  const w = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div className="h-2.5 w-full rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
      <div
        className="h-full rounded-full bg-[#46769B] transition-all"
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

export default function DailyTargets({ daily, dailyHydrationOz }) {
  // Display strings (fmt already handles nulls nicely)
  const dailyCalories = fmt(daily?.calories);
  const dailyProtein = fmt(daily?.protein);
  const dailyCarbs = fmt(daily?.carbs);
  const dailyFat = fmt(daily?.fat);

  // A tiny “data completeness” metric: how many macro fields are present
  const completeness = useMemo(() => {
    const c = safeNumber(daily?.calories) != null ? 1 : 0;
    const p = safeNumber(daily?.protein) != null ? 1 : 0;
    const carbs = safeNumber(daily?.carbs) != null ? 1 : 0;
    const f = safeNumber(daily?.fat) != null ? 1 : 0;
    const done = c + p + carbs + f;
    const total = 4;
    return { done, total, pct: safePct(done, total) };
  }, [daily?.calories, daily?.protein, daily?.carbs, daily?.fat]);

  const hydrationLabel =
    dailyHydrationOz != null ? `Hydration ${dailyHydrationOz} oz` : "Hydration —";

  return (
    <div className="relative rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible">
      {/* Premium accent + wash to match the MealTargets card language */}
      <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-70" />
      <div className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-b from-blue-50/35 to-white/0" />

      <div className="relative p-4">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-sm font-extrabold text-gray-900 truncate">Daily Targets</p>

              {/* “Primo” micro-pill: shows whether the card has full macro data */}
              <TinyPill tone={completeness.pct >= 100 ? "ok" : "soft"}>
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <Target className="w-3.5 h-3.5" />
                  {completeness.done}/{completeness.total}
                </span>
              </TinyPill>
            </div>

            <p className="text-xs text-gray-500 mt-1">
              Aim to be close — consistency beats perfection.
            </p>
          </div>

          {/* Hydration pill (keeps layout stable with whitespace-nowrap) */}
          <div className="shrink-0">
            {dailyHydrationOz != null ? (
              <TinyPill tone="ok">
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <Droplets className="w-3.5 h-3.5" />
                  {hydrationLabel}
                </span>
              </TinyPill>
            ) : (
              <TinyPill tone="soft">
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <Droplets className="w-3.5 h-3.5" />
                  {hydrationLabel}
                </span>
              </TinyPill>
            )}
          </div>
        </div>

        {/* Macro tiles */}
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile
            label="Calories"
            value={dailyCalories}
            unit="kcal"
            tone="amber"
            icon={<Flame className="w-4 h-4 text-amber-700" />}
          />

          <StatTile
            label="Protein"
            value={dailyProtein}
            unit="grams"
            tone="soft"
            icon={<Target className="w-4 h-4 text-[#2F5E7A]" />}
          />

          <StatTile
            label="Carbs"
            value={dailyCarbs}
            unit="grams"
            tone="blue"
            icon={<Zap className="w-4 h-4 text-blue-700" />}
          />

          <StatTile
            label="Fat"
            value={dailyFat}
            unit="grams"
            tone="soft"
            icon={<Droplets className="w-4 h-4 text-gray-700" />}
          />
        </div>

        {/* Footer microcopy (premium, subtle) */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <p className="text-[11px] text-gray-500 font-semibold line-clamp-1 sm:line-clamp-none">
            Don’t stress perfect numbers — stay within the guardrails.
          </p>
          <p className="text-[11px] text-gray-500 font-extrabold whitespace-nowrap">
            Consistency &gt; perfection
          </p>
        </div>
      </div>
    </div>
  );
}
