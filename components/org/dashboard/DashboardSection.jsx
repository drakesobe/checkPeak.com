// components/org/dashboard/DashboardSection.jsx
"use client";

import { useMemo, useState, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * DashboardSection
 * - Consistent “section card” wrapper for dashboard blocks
 * - Optional collapsible behavior (with localStorage persistence)
 *
 * Props:
 *  - title: string (required)
 *  - subtitle: string (optional)
 *  - right: ReactNode (optional)           -> renders top-right actions
 *  - children: ReactNode
 *  - className: string (optional)         -> outer card
 *  - contentClassName: string (optional)  -> inner content wrapper
 *  - collapsible: boolean (default false)
 *  - defaultCollapsed: boolean (default false)
 *  - storageKey: string (optional)        -> persists collapsed state in localStorage
 */

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function readBoolLS(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    return String(v) === "true";
  } catch {
    return fallback;
  }
}

function writeBoolLS(key, val) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, val ? "true" : "false");
  } catch {
    // ignore
  }
}

export default function DashboardSection({
  title,
  subtitle = "",
  right = null,
  children,
  className = "",
  contentClassName = "",
  collapsible = false,
  defaultCollapsed = false,
  storageKey = "",
}) {
  const initialCollapsed = useMemo(() => {
    if (!collapsible) return false;
    if (!storageKey) return Boolean(defaultCollapsed);
    return readBoolLS(storageKey, Boolean(defaultCollapsed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsible, storageKey, defaultCollapsed]);

  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const setCollapsedSafe = useCallback(
    (next) => {
      setCollapsed((prev) => {
        const v = typeof next === "function" ? next(prev) : next;
        if (collapsible && storageKey) writeBoolLS(storageKey, v);
        return v;
      });
    },
    [collapsible, storageKey]
  );

  const ToggleIcon = collapsed ? ChevronDown : ChevronUp;

  return (
    <section className={cx("bg-white rounded-2xl shadow-md border border-blue-100", className)}>
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-gray-900">{title}</h2>

              {collapsible ? (
                <button
                  type="button"
                  onClick={() => setCollapsedSafe((v) => !v)}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 px-2 py-1 text-[11px] font-semibold"
                  aria-label={collapsed ? "Expand section" : "Collapse section"}
                >
                  <ToggleIcon className="w-4 h-4" />
                </button>
              ) : null}
            </div>

            {subtitle ? <p className="text-sm text-gray-600 mt-1 leading-relaxed">{subtitle}</p> : null}
          </div>

          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      </div>

      {/* Content */}
      {!collapsed ? (
        <div className={cx("p-5 sm:p-6", contentClassName)}>{children}</div>
      ) : (
        <div className="p-5 sm:p-6">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-800">Section collapsed</p>
            <p className="text-[12px] text-gray-600 mt-1">
              Expand when you’re ready—this dashboard updates live as athletes complete work.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
