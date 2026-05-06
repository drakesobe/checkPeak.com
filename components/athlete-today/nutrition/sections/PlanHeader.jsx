// components/athlete-today/nutrition/sections/PlanHeader.jsx
"use client";

import { RefreshCcw, CheckCircle2, Flame, Target, Zap, Droplets } from "lucide-react";
import { fmt, fmtHumanDate, isISODateOnly } from "../helpers";

const C = {
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F8",
  brandBorder: "#C5D5E8",
};

function MacroItem({ icon, label, value }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {icon}
      <span className="text-[13px] font-extrabold text-gray-900 tabular-nums leading-none">{value}</span>
      <span className="text-[11px] text-gray-400 leading-none">{label}</span>
    </div>
  );
}

export default function PlanHeader({
  planName,
  effectiveDate,
  daily,
  dailyHydrationOz,
  completionCounts,
  onRefresh,
}) {
  const { done, total } = completionCounts || { done: 0, total: 0 };
  const isAllDone = total > 0 && done >= total;
  const pctVal    = total > 0 ? Math.round((done / total) * 100) : 0;
  const barColor  = isAllDone ? "#10B981" : C.brand;

  const progressStyle = isAllDone
    ? { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0", color: "#065F46" }
    : { backgroundColor: C.brandBg,  borderColor: C.brandBorder, color: C.brand };

  return (
    <div
      className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
      style={{ borderTop: `3px solid ${C.brand}` }}
    >
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-extrabold text-gray-900 truncate">
                {planName || "Nutrition Plan"}
              </p>

              {/* Single progress chip */}
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none whitespace-nowrap"
                style={progressStyle}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {total > 0 ? `${done}/${total}` : "No items"}
              </span>
            </div>

            {effectiveDate && isISODateOnly(effectiveDate) && (
              <p className="text-[11px] text-gray-500 mt-0.5">
                Effective {fmtHumanDate(effectiveDate)}
              </p>
            )}
          </div>

          {/* Refresh */}
          <button
            type="button"
            onClick={onRefresh}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pctVal}%`, backgroundColor: barColor }}
            />
          </div>
        )}

        {/* Macro row - always visible, tight */}
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2.5">
          <MacroItem
            icon={<Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
            label="kcal"
            value={fmt(daily?.calories)}
          />
          <MacroItem
            icon={<Target className="w-3.5 h-3.5 shrink-0" style={{ color: C.brand }} />}
            label="protein"
            value={fmt(daily?.protein) !== "-" ? `${fmt(daily?.protein)}g` : "-"}
          />
          <MacroItem
            icon={<Zap className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
            label="carbs"
            value={fmt(daily?.carbs) !== "-" ? `${fmt(daily?.carbs)}g` : "-"}
          />
          <MacroItem
            icon={<Droplets className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
            label="fat"
            value={fmt(daily?.fat) !== "-" ? `${fmt(daily?.fat)}g` : "-"}
          />
        </div>
      </div>
    </div>
  );
}