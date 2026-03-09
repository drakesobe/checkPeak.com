// components/org/trainers/ui.js
// Shared primitives. Zero external dependencies beyond React + lucide.

import { DS, FONT_CONDENSED } from "./ds.js";

/* ── Label ─────────────────────────────────────────────── */
export function FieldLabel({ children }) {
  return (
    <label
      className="block text-xs font-bold uppercase tracking-widest mb-1.5"
      style={{ color: DS.labelText }}
    >
      {children}
    </label>
  );
}

/* ── Text Input ─────────────────────────────────────────── */
export function Input({ className = "", style = {}, ...props }) {
  return (
    <input
      className={`w-full px-3 py-2.5 text-sm outline-none transition-colors ${className}`}
      style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, color: DS.bodyText, ...style }}
      onFocus={e  => { e.currentTarget.style.borderColor = DS.brand; }}
      onBlur={e   => { e.currentTarget.style.borderColor = DS.border; }}
      {...props}
    />
  );
}

/* ── Select ─────────────────────────────────────────────── */
export function Select({ className = "", style = {}, children, ...props }) {
  return (
    <select
      className={`w-full px-3 py-2.5 text-sm outline-none transition-colors ${className}`}
      style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, color: DS.bodyText, ...style }}
      onFocus={e  => { e.currentTarget.style.borderColor = DS.brand; }}
      onBlur={e   => { e.currentTarget.style.borderColor = DS.border; }}
      {...props}
    >
      {children}
    </select>
  );
}

/* ── Button ─────────────────────────────────────────────── */
const BTN_STYLES = {
  primary:   { backgroundColor: DS.brand,  border: `1px solid ${DS.brand}`,  color: "#FFF"        },
  secondary: { backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, color: DS.labelText  },
  danger:    { backgroundColor: DS.bad,    border: `1px solid ${DS.bad}`,    color: "#FFF"        },
  ghost:     { backgroundColor: "transparent", border: `1px solid ${DS.border}`, color: DS.labelText },
};

export function Btn({
  children, onClick, disabled = false,
  variant = "secondary", className = "", style = {}, type = "button", title,
}) {
  return (
    <button
      type={type} onClick={onClick} disabled={disabled} title={title}
      className={`
        inline-flex items-center justify-center gap-2
        px-4 py-2.5 text-xs font-bold uppercase tracking-widest
        transition-opacity
        disabled:opacity-40 disabled:cursor-not-allowed
        ${className}
      `}
      style={{ ...BTN_STYLES[variant], ...style }}
    >
      {children}
    </button>
  );
}

/* ── Role Pill ──────────────────────────────────────────── */
export function RolePill({ role }) {
  const isAdmin = String(role || "").toLowerCase() === "admin";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-widest"
      style={{
        backgroundColor: isAdmin ? DS.brandBg : "#F4F7FB",
        border:          `1px solid ${isAdmin ? DS.brandBorder : DS.border}`,
        color:           isAdmin ? DS.brand : DS.labelText,
      }}
    >
      {role || "trainer"}
    </span>
  );
}

/* ── Status Pill ────────────────────────────────────────── */
export function StatusPill({ active }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-widest"
      style={{
        backgroundColor: active ? DS.goodBg  : DS.warnBg,
        border:          `1px solid ${active ? DS.goodBorder : DS.warnBorder}`,
        color:           active ? DS.good    : DS.warn,
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/* ── Banner ─────────────────────────────────────────────── */
export function Banner({ type = "error", children }) {
  const map = {
    error:   { bg: DS.badBg,  border: DS.badBorder,  color: DS.bad  },
    warning: { bg: DS.warnBg, border: DS.warnBorder, color: DS.warn },
    success: { bg: DS.goodBg, border: DS.goodBorder, color: DS.good },
  };
  const s = map[type] || map.error;
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 text-sm font-semibold"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {children}
    </div>
  );
}

/* ── Section Heading ────────────────────────────────────── */
export function SectionHeading({ children }) {
  return (
    <h2
      className="font-black leading-none"
      style={{ fontFamily: FONT_CONDENSED, fontSize: "1.35rem", color: DS.bodyText, letterSpacing: "-0.01em" }}
    >
      {children}
    </h2>
  );
}