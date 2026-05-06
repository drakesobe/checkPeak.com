// /components/dashboard/ui.jsx
"use client";

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

const BRAND     = "#5B9EC9";
const FONT_COND = "'Barlow Condensed', sans-serif";
const FONT_BODY = "'Barlow', sans-serif";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

export function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* SidebarLink                                                                 */
/* -------------------------------------------------------------------------- */

export function SidebarLink({ label, icon, active = false, onClick, badge = null }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full inline-flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all"
      style={{
        background: active ? "rgba(91,158,201,0.1)" : "transparent",
        border:     active ? "1px solid rgba(91,158,201,0.28)" : "1px solid transparent",
        color:      active ? "#1e6fa3" : "#475569",
        fontFamily: FONT_BODY,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "#f1f5f9";
          e.currentTarget.style.color      = "#1e293b";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color      = "#475569";
        }
      }}
    >
      <span className="inline-flex items-center gap-2.5 min-w-0">
        {/* Icon box - explicit color so it overrides any className on the icon itself */}
        <span
          className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: active ? "rgba(91,158,201,0.15)" : "#f1f5f9",
            border:     active ? "1px solid rgba(91,158,201,0.28)" : "1px solid #e2e8f0",
            color:      active ? BRAND : "#64748b",
            /* force icon SVGs inside to inherit this color */
            fill:       "none",
          }}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </span>

      <span className="inline-flex items-center gap-2 shrink-0">
        {badge ? (
          <span
            className="h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-extrabold grid place-items-center"
            style={{
              background: "rgba(217,119,6,0.1)",
              border:     "1px solid rgba(217,119,6,0.28)",
              color:      "#b45309",
            }}
          >
            {badge}
          </span>
        ) : null}
        {active && (
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: BRAND }} />
        )}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* StatCard                                                                    */
/*                                                                             */
/* IMPORTANT - icon color:                                                    */
/* Lucide icons passed from StatsGrid carry their own className (e.g.         */
/* text-blue-600). We wrap them in a <span> with an explicit CSS `color`      */
/* AND render a cloneElement override so the icon always uses our tone color. */
/* -------------------------------------------------------------------------- */

import { cloneElement } from "react";

const TONE_STYLES = {
  primary: {
    background:  "#ffffff",
    border:      "1px solid #bfdbf7",
    iconBg:      "#eff6ff",
    iconBorder:  "#bfdbf7",
    iconColor:   BRAND,
    valueColor:  "#0f172a",
    labelColor:  "#475569",
    subColor:    "#94a3b8",
    accent:      BRAND,
  },
  neutral: {
    background:  "#ffffff",
    border:      "1px solid #e2e8f0",
    iconBg:      "#f8fafc",
    iconBorder:  "#e2e8f0",
    iconColor:   "#64748b",
    valueColor:  "#0f172a",
    labelColor:  "#475569",
    subColor:    "#94a3b8",
    accent:      "#94a3b8",
  },
  success: {
    background:  "#ffffff",
    border:      "1px solid #bfdbf7",
    iconBg:      "#eff6ff",
    iconBorder:  "#bfdbf7",
    iconColor:   BRAND,
    valueColor:  "#0f172a",
    labelColor:  "#475569",
    subColor:    "#94a3b8",
    accent:      BRAND,
  },
  warning: {
    background:  "#fffbeb",
    border:      "1px solid #fcd34d",
    iconBg:      "#fef3c7",
    iconBorder:  "#fcd34d",
    iconColor:   "#b45309",
    valueColor:  "#78350f",
    labelColor:  "#475569",
    subColor:    "#b45309",
    accent:      "#f59e0b",
  },
};

export function StatCard({ label, value, icon, tone = "neutral", subLabel }) {
  const t = TONE_STYLES[tone] ?? TONE_STYLES.neutral;

  /* Strip any className from the icon and force our tone color via style */
  const themedIcon = icon
    ? cloneElement(icon, {
        className: undefined,
        style: { color: t.iconColor, width: 14, height: 14, flexShrink: 0 },
      })
    : null;

  return (
    <div
      className="rounded-2xl p-4 flex flex-col justify-between"
      style={{
        background: t.background,
        border:     t.border,
        boxShadow:  "0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        fontFamily: FONT_BODY,
      }}
    >
      {/* Top row: label + icon */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <p
          className="text-[10px] font-bold uppercase leading-tight"
          style={{ color: t.labelColor, fontFamily: FONT_COND, letterSpacing: "0.09em" }}
        >
          {label}
        </p>
        <div
          className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center"
          style={{
            background: t.iconBg,
            border:     `1px solid ${t.iconBorder}`,
            color:      t.iconColor,
          }}
        >
          {themedIcon}
        </div>
      </div>

      {/* Value */}
      <p
        className="text-3xl font-black leading-none"
        style={{ color: t.valueColor, fontFamily: FONT_COND, letterSpacing: "0.01em" }}
      >
        {value ?? "-"}
      </p>

      {/* Sub-label */}
      {subLabel && (
        <p className="mt-1.5 text-[10px] font-medium" style={{ color: t.subColor }}>
          {subLabel}
        </p>
      )}

      {/* Bottom accent line */}
      <div
        className="mt-3 h-0.5 rounded-full"
        style={{ background: t.accent, opacity: 0.5 }}
      />
    </div>
  );
}