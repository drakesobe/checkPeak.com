// components/athlete-today/ui/atoms/Pill.jsx
"use client";

import { classNames } from "../utils";

export default function Pill({ children, tone = "neutral", className = "" }) {
  const toneCls =
    tone === "attention" || tone === "bad"
      ? "bg-red-50 text-red-800 border-red-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full border",
        "px-2 py-0.5 sm:px-2.5 sm:py-1",
        "text-[10px] sm:text-[11px] font-semibold leading-none whitespace-nowrap",
        "tabular-nums",
        toneCls,
        className
      )}
    >
      {children}
    </span>
  );
}
