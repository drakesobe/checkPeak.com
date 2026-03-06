// components/org/workoutsCalendar/BottomSheet.jsx
// Note: "BottomSheet" is now a centered dialog on all breakpoints — the name
// is retained for import compatibility but the layout matches the DS panel pattern.
"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";

export default function BottomSheet({
  open,
  title,
  children,
  onClose,
  subtitle,
  topOffsetPx,   // kept for API compat — not used in centered layout
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        role="button"
        tabIndex={0}
        aria-label="Close sheet"
      />

      {/* Centered panel — same DS panel system as Modal / DaySheet */}
      <div className="absolute inset-0 flex items-center justify-center px-3 py-4 sm:px-6 sm:py-8">
        <div
          className="w-full flex flex-col"
          style={{
            maxWidth:        "680px",
            backgroundColor: DS.cardBg,
            border:          `1px solid ${DS.border}`,
            borderTop:       `3px solid ${DS.brand}`,
            maxHeight:       "calc(100dvh - 32px)",
            overflow:        "hidden",
          }}
          role="dialog"
          aria-modal="true"
          aria-label={title || "Sheet"}
        >
          {/* Header */}
          <div
            className="flex items-start justify-between gap-4 shrink-0"
            style={{
              padding:         "16px 20px",
              borderBottom:    `1px solid ${DS.border}`,
              backgroundColor: DS.pageBg,
            }}
          >
            <div className="min-w-0">
              <p
                className="truncate"
                style={{
                  fontSize:      "13px",
                  fontWeight:    900,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color:         DS.bodyText,
                }}
              >
                {title}
              </p>
              {subtitle && (
                <p style={{ fontSize: "11px", color: DS.dimText, marginTop: "4px", lineHeight: 1.4 }}>
                  {subtitle}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                padding:         "6px",
                border:          `1px solid ${DS.border}`,
                backgroundColor: DS.cardBg,
                cursor:          "pointer",
                flexShrink:      0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.pageBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.cardBg; }}
            >
              <X className="w-4 h-4" style={{ color: DS.dimText }} />
            </button>
          </div>

          {/* Body — scrollable */}
          <div
            className="overflow-y-auto overscroll-contain flex-1"
            style={{ padding: "20px" }}
          >
            {children}
            <div style={{ height: "8px" }} />
          </div>
        </div>
      </div>
    </div>
  );
}