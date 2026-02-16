// components/athlete-today/nutrition/ui/ProgressBar.jsx
"use client";

import { cx } from "../helpers";

export default function ProgressBar({
  pctValue,
  label = "Progress",
  showMeta = true,
  size = "md", // "sm" | "md"
}) {
  const w = Math.max(0, Math.min(100, Number(pctValue) || 0));
  const isDone = w >= 100;

  const hCls = size === "sm" ? "h-2" : "h-2.5";
  const padCls = size === "sm" ? "p-2" : "p-3";

  return (
    <div
      className={cx(
        "rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden",
        padCls
      )}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(w)}
    >
      {/* Top row (optional) */}
      {showMeta ? (
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-700 truncate">
            {label}
          </p>

          <span
            className={cx(
              "inline-flex items-center rounded-full border px-2 py-0.5",
              "text-[10px] font-extrabold tabular-nums whitespace-nowrap",
              isDone
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-gray-50 border-gray-200 text-gray-700"
            )}
          >
            {Math.round(w)}%
          </span>
        </div>
      ) : null}

      {/* Track */}
      <div
        className={cx(
          "w-full rounded-full bg-gray-100 border border-gray-200 overflow-hidden",
          hCls
        )}
      >
        {/* Fill */}
        <div
          className={cx(
            "h-full rounded-full transition-all duration-300",
            isDone ? "bg-emerald-600" : "bg-[#46769B]"
          )}
          style={{ width: `${w}%` }}
        />
      </div>

      {/* Microcopy */}
      {showMeta ? (
        <p className="mt-2 text-[11px] text-gray-500">
          {isDone ? "Complete — nice work." : "Keep going — consistency wins."}
        </p>
      ) : null}
    </div>
  );
}
