// components/org/workoutsCalendar/Modal.jsx
"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";

export default function Modal({
  open,
  title,
  children,
  onClose,
  subtitle,
  maxWidth = "560px",   // accepts px string or Tailwind class — we default to px for DS consistency
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    setTimeout(() => panelRef.current?.focus?.(), 0);
    return () => {
      document.documentElement.style.overflow = prev || "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Resolve maxWidth — accept either a raw px/rem value or a legacy Tailwind class string
  // e.g. "max-w-3xl" → we just pass it as className; a pixel value → inline style
  const isTailwind = typeof maxWidth === "string" && maxWidth.startsWith("max-w-");
  const widthStyle = isTailwind ? {} : { maxWidth };
  const widthClass = isTailwind ? maxWidth : "";

  return (
    <div
      className="fixed inset-0 z-[9999]"
      role="dialog"
      aria-modal="true"
      aria-label={title || "Modal"}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Centering */}
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">

        {/* Panel */}
        <div
          ref={panelRef}
          tabIndex={-1}
          className={`w-full flex flex-col outline-none ${widthClass}`}
          style={{
            backgroundColor: DS.cardBg,
            border:          `1px solid ${DS.border}`,
            borderTop:       `3px solid ${DS.brand}`,
            maxHeight:       "92dvh",
            overflow:        "hidden",
            ...widthStyle,
          }}
          onClick={(e) => e.stopPropagation()}
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
                <p style={{ fontSize: "11px", color: DS.dimText, marginTop: "4px" }}>
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
            className="overflow-y-auto flex-1"
            style={{ padding: "20px" }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}