"use client";

import { useMemo } from "react";
import { Droplets, Flame, Target, Zap } from "lucide-react";
import { fmt } from "../helpers";
import TinyPill from "../ui/TinyPill";

function safeNumber(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function safePct(done, total) {
  const d = safeNumber(done);
  const t = safeNumber(total);
  if (d == null || t == null || t <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((d / t) * 100)));
}

/* -------------------------------------------------------------------------- */
/* Desktop tiles (keep your premium look on sm+)                               */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Mobile row list (quiet, readable, not “hero”)                               */
/* -------------------------------------------------------------------------- */

function MobileMacroRow({ icon, label, value, unit }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex items-center gap-2">
        <span className="shrink-0">{icon}</span>
        <p className="text-[12px] font-semibold text-gray-700 truncate">{label}</p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-[13px] font-extrabold text-gray-900 tabular-nums leading-none">
          {value}
        </p>
        <p className="text-[10px] font-semibold text-gray-500 leading-none mt-1">
          {unit}
        </p>
      </div>
    </div>
  );
}

export default function DailyTargets({ daily, dailyHydrationOz }) {
  const dailyCalories = fmt(daily?.calories);
  const dailyProtein = fmt(daily?.protein);
  const dailyCarbs = fmt(daily?.carbs);
  const dailyFat = fmt(daily?.fat);

  // keep (optional) completeness computation for future use, but we no longer show it in the UI
  useMemo(() => {
    const c = safeNumber(daily?.calories) != null ? 1 : 0;
    const p = safeNumber(daily?.protein) != null ? 1 : 0;
    const carbs = safeNumber(daily?.carbs) != null ? 1 : 0;
    const f = safeNumber(daily?.fat) != null ? 1 : 0;
    const done = c + p + carbs + f;
    const total = 4;
    return { done, total, pct: safePct(done, total) };
  }, [daily?.calories, daily?.protein, daily?.carbs, daily?.fat]);

  const hydrationLabel = dailyHydrationOz != null ? `${dailyHydrationOz} oz` : "—";

  return (
    <div className="relative rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible">
      {/* Quiet on mobile: no loud accent. Premium accent only on sm+ */}
      <div className="hidden sm:block absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-70" />
      <div className="hidden sm:block absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-b from-blue-50/35 to-white/0" />

      <div className="relative p-4">
        {/* Header row (tight on mobile) */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-extrabold text-gray-900">Daily targets</p>

              {/* REMOVED: target icon + completeness numbers pill */}
            </div>

            {/* Remove noisy subcopy on mobile */}
            <p className="hidden sm:block text-xs text-gray-500 mt-1">
              Daily macro targets and hydration goal.
            </p>
          </div>

          {/* Hydration pill */}
          <div className="shrink-0">
            <TinyPill tone={dailyHydrationOz != null ? "ok" : "soft"}>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Droplets className="w-3.5 h-3.5" />
                {hydrationLabel}
              </span>
            </TinyPill>
          </div>
        </div>

        {/* MOBILE: quiet stacked rows */}
        <div className="mt-3 sm:hidden rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden">
          <MobileMacroRow
            label="Calories"
            value={dailyCalories}
            unit="kcal"
            icon={<Flame className="w-4 h-4 text-amber-700" />}
          />
          <div className="h-px w-full bg-gray-200" />
          <MobileMacroRow
            label="Protein"
            value={dailyProtein}
            unit="grams"
            icon={<Target className="w-4 h-4 text-[#2F5E7A]" />}
          />
          <div className="h-px w-full bg-gray-200" />
          <MobileMacroRow
            label="Carbs"
            value={dailyCarbs}
            unit="grams"
            icon={<Zap className="w-4 h-4 text-blue-700" />}
          />
          <div className="h-px w-full bg-gray-200" />
          <MobileMacroRow
            label="Fat"
            value={dailyFat}
            unit="grams"
            icon={<Droplets className="w-4 h-4 text-gray-700" />}
          />
        </div>

        {/* DESKTOP/TABLET: keep premium tiles */}
        <div className="mt-3 hidden sm:grid grid-cols-2 md:grid-cols-4 gap-3">
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

        {/* Footer microcopy: keep on sm+ only */}
        <div className="hidden sm:flex mt-3 flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <p className="text-[11px] text-gray-500 font-semibold line-clamp-1 sm:line-clamp-none">
            Don’t stress perfect numbers. Focus on consistent progress and habits.
          </p>
          <p className="text-[11px] text-gray-500 font-extrabold whitespace-nowrap">
            Consistency &gt; perfection
          </p>
        </div>
      </div>
    </div>
  );
}
