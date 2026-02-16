// components/athlete-today/nutrition/ui/TinyPill.jsx
"use client";

import { cx } from "../helpers";

export default function TinyPill({
  children,
  tone = "base", // base | soft | blue | ok | warn | dark
  className = "",
  dot = false, // adds a small status dot on the left
  dotTone, // optional override for dot color
  icon = null, // optional React node (lucide icon)
}) {
  const toneCls =
    tone === "dark"
      ? "bg-gray-900 text-white border-gray-900"
      : tone === "soft"
      ? "bg-gray-50 text-gray-700 border-gray-200"
      : tone === "blue"
      ? "bg-blue-50 text-blue-800 border-blue-200"
      : tone === "ok"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : "bg-white text-gray-800 border-gray-200";

  // dot color defaults follow tone unless overridden
  const dotCls =
    dotTone ||
    (tone === "ok"
      ? "bg-emerald-600"
      : tone === "blue"
      ? "bg-blue-600"
      : tone === "warn"
      ? "bg-amber-500"
      : tone === "dark"
      ? "bg-white/80"
      : "bg-gray-400");

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border",
        "px-2.5 py-1 text-[11px] font-semibold",
        "whitespace-nowrap select-none",
        toneCls,
        className
      )}
    >
      {dot ? <span className={cx("h-1.5 w-1.5 rounded-full", dotCls)} aria-hidden="true" /> : null}

      {icon ? (
        <span className="inline-flex items-center justify-center shrink-0" aria-hidden="true">
          {icon}
        </span>
      ) : null}

      <span className="truncate">{children}</span>
    </span>
  );
}
