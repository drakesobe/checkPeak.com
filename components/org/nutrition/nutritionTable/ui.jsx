// components/org/nutrition/nutritionTable/ui.jsx
"use client";

import { cx, clampPct, safeText } from "./helpers";

export function ProgressBar({ value }) {
  const n = clampPct(value);
  const w = n == null ? 0 : n;
  const bar = n == null ? "bg-gray-200" : n >= 80 ? "bg-emerald-500" : n >= 65 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
      <div className={cx("h-full", bar)} style={{ width: `${w}%` }} />
    </div>
  );
}

export function MiniChip({ children, tone = "neutral" }) {
  const cls =
    tone === "blue"
      ? "bg-blue-50 text-blue-900 border-blue-200"
      : tone === "emerald"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : tone === "amber"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : tone === "red"
      ? "bg-red-50 text-red-900 border-red-200"
      : "bg-gray-50 text-gray-800 border-gray-200";

  return (
    <span className={cx("inline-flex px-2 py-0.5 rounded-lg border text-[11px] font-semibold", cls)}>{children}</span>
  );
}

export function MacroPill({ label, value }) {
  const t = safeText(value);
  if (!t) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-[11px] text-gray-700">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900">{t}</span>
    </span>
  );
}