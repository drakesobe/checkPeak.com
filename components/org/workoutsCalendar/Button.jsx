// components/org/workoutsCalendar/Button.jsx  (also used as shared primitive)
"use client";

import { DS } from "@/components/org/dashboard/DashboardUI";

export default function Button({
  children,
  onClick,
  variant  = "secondary", // primary | secondary | dark | danger
  disabled = false,
  className = "",
  title    = "",
  type     = "button",
  style    = {},
}) {
  // Base layout — no border-radius, no Tailwind color classes
  const base = {
    display:       "inline-flex",
    alignItems:    "center",
    justifyContent:"center",
    gap:           "6px",
    padding:       "8px 16px",
    fontSize:      "12px",
    fontWeight:    900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    lineHeight:    1,
    cursor:        disabled ? "not-allowed" : "pointer",
    opacity:       disabled ? 0.45 : 1,
    transition:    "background-color 0.12s, border-color 0.12s, color 0.12s",
    outline:       "none",
    whiteSpace:    "nowrap",
  };

  const variants = {
    primary: {
      backgroundColor: DS.brand,
      border:          `1px solid ${DS.brand}`,
      color:           "#fff",
    },
    secondary: {
      backgroundColor: DS.cardBg,
      border:          `1px solid ${DS.border}`,
      color:           DS.labelText,
    },
    dark: {
      backgroundColor: DS.bodyText,
      border:          `1px solid ${DS.bodyText}`,
      color:           "#fff",
    },
    danger: {
      backgroundColor: DS.bannedBg,
      border:          `1px solid ${DS.bannedBorder}`,
      color:           DS.banned,
    },
  };

  const merged = { ...base, ...(variants[variant] || variants.secondary), ...style };

  const handleEnter = (e) => {
    if (disabled) return;
    const el = e.currentTarget;
    if (variant === "primary") {
      el.style.backgroundColor = DS.brandLight;
    } else if (variant === "dark") {
      el.style.opacity = "0.85";
    } else if (variant === "danger") {
      el.style.backgroundColor = DS.banned;
      el.style.color            = "#fff";
    } else {
      el.style.backgroundColor = DS.brandBg;
      el.style.borderColor     = DS.brandBorder;
      el.style.color           = DS.brand;
    }
  };

  const handleLeave = (e) => {
    if (disabled) return;
    const el  = e.currentTarget;
    const cfg = variants[variant] || variants.secondary;
    el.style.backgroundColor = cfg.backgroundColor;
    el.style.borderColor     = cfg.border?.replace("1px solid ", "") || DS.border;
    el.style.color           = cfg.color;
    el.style.opacity         = "1";
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={merged}
      className={className}           // still accepts className for layout overrides (w-full etc.)
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
    </button>
  );
}