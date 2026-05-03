// components/org/workouts-calendar/DashboardUI.jsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, X, Tag, AlertTriangle, CheckCircle2 } from "lucide-react";

// ─── Design System tokens ────────────────────────────────────────────────────
export const DS = {
  brand:         "#1E3A5F",
  brandLight:    "#2A4F7C",
  brandBg:       "#EEF3F9",
  brandBorder:   "#C0D0E0",
  safe:          "#00873E",
  safeBg:        "#F0FBF4",
  safeBorder:    "#A8DFB8",
  caution:       "#B86000",
  cautionBg:     "#FFFBF0",
  cautionBorder: "#FFD580",
  banned:        "#C8102E",
  bannedBg:      "#FFF0F0",
  bannedBorder:  "#FFC8C8",
  border:        "#E8ECF0",
  pageBg:        "#F4F7FB",
  cardBg:        "#FFFFFF",
  bodyText:      "#1A2535",
  labelText:     "#5A6A7D",
  dimText:       "#9BA8B4",
};

// ─── StatCard ─────────────────────────────────────────────────────────────────
export function StatCard({ icon: Icon, label, value, sub, href, onClick }) {
  const clickable = Boolean(href || onClick);
  const [hovered, setHovered] = useState(false);

  const inner = (
    <div
      className="p-4 w-full text-left transition-all"
      style={{
        backgroundColor: hovered && clickable ? DS.brandBg : DS.cardBg,
        border:          `1px solid ${DS.border}`,
        borderTop:       `3px solid ${DS.brand}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.dimText }}>{label}</p>
          <p
            className="text-2xl font-black mt-1 tabular-nums"
            style={{ color: DS.bodyText, fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            {value}
          </p>
          {sub ? <p className="text-xs mt-1.5" style={{ color: DS.dimText }}>{sub}</p> : null}
          {clickable && (
            <p className="text-xs font-bold mt-2 transition-all" style={{ color: DS.brand }}>View →</p>
          )}
        </div>
        <div
          className="shrink-0 w-9 h-9 flex items-center justify-center"
          style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}
        >
          <Icon className="w-4 h-4" style={{ color: DS.brand }} />
        </div>
      </div>
    </div>
  );

  const handlers = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  if (href)    return <Link href={href} className="block" aria-label={label} {...handlers}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className="block w-full" aria-label={label} {...handlers}>{inner}</button>;
  return inner;
}

// ─── Pill ─────────────────────────────────────────────────────────────────────
export function Pill({ children, tone = "neutral" }) {
  const styles = {
    warn:    { backgroundColor: DS.cautionBg, color: DS.caution,   border: `1px solid ${DS.cautionBorder}` },
    bad:     { backgroundColor: DS.bannedBg,  color: DS.banned,    border: `1px solid ${DS.bannedBorder}`  },
    good:    { backgroundColor: DS.safeBg,    color: DS.safe,      border: `1px solid ${DS.safeBorder}`    },
    neutral: { backgroundColor: DS.pageBg,    color: DS.labelText, border: `1px solid ${DS.border}`        },
  };
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-sm"
      style={styles[tone] || styles.neutral}
    >
      {children}
    </span>
  );
}

// ─── TagChip ──────────────────────────────────────────────────────────────────
export function TagChip({ text }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-sm"
      style={{ backgroundColor: DS.brandBg, color: DS.brand, border: `1px solid ${DS.brandBorder}` }}
    >
      <Tag className="w-3 h-3 shrink-0" />
      <span className="break-words">{text}</span>
    </span>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
export function Button({
  children, onClick, variant = "primary", disabled = false,
  className = "", title = "", type = "button",
}) {
  const [hovered, setHovered] = useState(false);

  function getStyle() {
    if (disabled) return {
      backgroundColor: DS.pageBg, color: DS.dimText,
      border: `1px solid ${DS.border}`, cursor: "not-allowed", opacity: 0.6,
    };
    const h = hovered;
    if (variant === "primary") return {
      backgroundColor: h ? DS.brandLight : DS.brand,
      color: "#fff", border: `1px solid ${h ? DS.brandLight : DS.brand}`,
    };
    if (variant === "dark") return {
      backgroundColor: h ? "#111" : DS.bodyText,
      color: "#fff", border: `1px solid ${DS.bodyText}`,
    };
    // secondary
    return {
      backgroundColor: h ? DS.brandBg   : DS.cardBg,
      color:           h ? DS.brand     : DS.labelText,
      border:         `1px solid ${h ? DS.brandBorder : DS.border}`,
    };
  }

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all ${className}`}
      style={getStyle()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
}

// ─── CopyButton ───────────────────────────────────────────────────────────────
export function CopyButton({ text, label = "Copy", compact = false }) {
  const [copied,  setCopied]  = useState(false);
  const [hovered, setHovered] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch { setCopied(false); }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      disabled={!text}
      className={`inline-flex items-center gap-1.5 rounded-sm transition-all ${compact ? "px-2 py-1.5" : "px-3 py-2"} text-xs font-black uppercase tracking-wide`}
      style={{
        backgroundColor: hovered ? DS.brandBg : DS.cardBg,
        color:           hovered ? DS.brand   : DS.labelText,
        border:         `1px solid ${hovered ? DS.brandBorder : DS.border}`,
        cursor: !text ? "not-allowed" : "pointer",
        opacity: !text ? 0.5 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Copy className="w-3.5 h-3.5 shrink-0" />
      {copied ? "Copied" : label}
    </button>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} role="button" tabIndex={0} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-xl"
          style={{
            backgroundColor: DS.cardBg,
            border:    `1px solid ${DS.border}`,
            borderTop: `3px solid ${DS.brand}`,
          }}
        >
          <div
            className="px-5 py-4 flex items-start justify-between gap-4"
            style={{ borderBottom: `1px solid ${DS.border}` }}
          >
            <p className="text-sm font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>
              {title}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-sm transition-all"
              style={{ border: `1px solid ${DS.border}`, color: DS.labelText }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.brand; e.currentTarget.style.color = DS.brand; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ─── PlanChip ─────────────────────────────────────────────────────────────────
export function PlanChip({ needsPlan, stale }) {
  if (needsPlan) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-sm"
      style={{ backgroundColor: DS.bannedBg, color: DS.banned, border: `1px solid ${DS.bannedBorder}` }}>
      <AlertTriangle className="w-3 h-3 shrink-0" /> Needs plan
    </span>
  );
  if (stale) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-sm"
      style={{ backgroundColor: DS.cautionBg, color: DS.caution, border: `1px solid ${DS.cautionBorder}` }}>
      <AlertTriangle className="w-3 h-3 shrink-0" /> Needs update
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-sm"
      style={{ backgroundColor: DS.safeBg, color: DS.safe, border: `1px solid ${DS.safeBorder}` }}>
      <CheckCircle2 className="w-3 h-3 shrink-0" /> Current
    </span>
  );
}

// legacy classNames helper (kept for components that still use it)
export function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}