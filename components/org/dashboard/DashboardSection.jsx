// components/org/workouts-calendar/DashboardSection.jsx
"use client";

import { useMemo, useState, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";

function readBoolLS(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : String(v) === "true";
  } catch { return fallback; }
}

function writeBoolLS(key, val) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, val ? "true" : "false"); } catch {}
}

/**
 * DashboardSection — card wrapper with DS tokens.
 * Use for content that is NOT itself a standalone card (e.g. StatsGrid).
 * For standalone panels (TodayWorkouts, Roster etc.) render them directly.
 */
export default function DashboardSection({
  title,
  subtitle = "",
  right = null,
  children,
  collapsible = false,
  defaultCollapsed = false,
  storageKey = "",
  accentTop = true,
}) {
  const initialCollapsed = useMemo(() => {
    if (!collapsible) return false;
    if (!storageKey)  return Boolean(defaultCollapsed);
    return readBoolLS(storageKey, Boolean(defaultCollapsed));
  }, [collapsible, storageKey, defaultCollapsed]);

  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (collapsible && storageKey) writeBoolLS(storageKey, next);
      return next;
    });
  }, [collapsible, storageKey]);

  return (
    <section
      style={{
        backgroundColor: DS.cardBg,
        border:          `1px solid ${DS.border}`,
        borderTop:       accentTop ? `3px solid ${DS.brand}` : `1px solid ${DS.border}`,
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-start justify-between gap-4"
        style={{ borderBottom: collapsed ? "none" : `1px solid ${DS.border}` }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-black uppercase tracking-wider" style={{ color: DS.brand }}>
              {title}
            </h2>
            {collapsible && (
              <button
                type="button"
                onClick={toggle}
                className="inline-flex items-center justify-center w-5 h-5 rounded-sm transition-all"
                style={{ border: `1px solid ${DS.border}`, color: DS.dimText }}
                aria-label={collapsed ? "Expand" : "Collapse"}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.brand; e.currentTarget.style.color = DS.brand; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.dimText; }}
              >
                {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </button>
            )}
          </div>
          {subtitle && (
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: DS.dimText }}>
              {subtitle}
            </p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>

      {/* Content */}
      {!collapsed ? (
        <div className="p-5">{children}</div>
      ) : (
        <div className="px-5 py-3">
          <p className="text-xs" style={{ color: DS.dimText }}>Section collapsed — click to expand.</p>
        </div>
      )}
    </section>
  );
}