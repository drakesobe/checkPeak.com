"use client";

import { classNames } from "@/components/org/trainers/utils/strings";

export default function Pill({
  children,
  tone = "neutral",
  className = "",
  truncate = false, // ✅ optional: truncate long content
  title = "",       // ✅ optional: tooltip
}) {
  const toneCls =
    tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-800 border-red-200"
      : tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : tone === "blue"
      ? "bg-blue-50 text-blue-900 border-blue-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      title={title}
      className={classNames(
        "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border",
        // ✅ mobile safety: allow shrinking inside flex rows
        "min-w-0 max-w-full",
        // ✅ prevent pill contents from forcing layout wider
        "overflow-hidden",
        // ✅ optional truncation for long content
        truncate ? "truncate whitespace-nowrap" : "",
        toneCls,
        className
      )}
    >
      {children}
    </span>
  );
}