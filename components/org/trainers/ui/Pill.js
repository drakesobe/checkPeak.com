// components/org/trainers/ui/Pill.js
"use client";

import { classNames } from "@/components/org/trainers/utils/strings";

export default function Pill({ children, tone = "neutral" }) {
  const toneCls =
    tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-800 border-red-200"
      : tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span className={classNames("inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border", toneCls)}>
      {children}
    </span>
  );
}
