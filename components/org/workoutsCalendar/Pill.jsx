// components/org/workoutsCalendar/Pill.jsx
"use client";

import { DS } from "@/components/org/dashboard/DashboardUI";

// DS-aligned tone map - matches the exact token values used across
// queue, prescriptions, dashboard, and workouts calendar
const TONES = {
  neutral: {
    soft:    { bg: DS.pageBg,    border: DS.border,        text: DS.labelText },
    solid:   { bg: DS.bodyText,  border: DS.bodyText,      text: "#fff"       },
    outline: { bg: "transparent",border: DS.border,        text: DS.labelText },
  },
  good: {
    soft:    { bg: DS.safeBg,    border: DS.safeBorder,    text: DS.safe      },
    solid:   { bg: DS.safe,      border: DS.safe,          text: "#fff"       },
    outline: { bg: "transparent",border: DS.safeBorder,    text: DS.safe      },
  },
  warn: {
    soft:    { bg: DS.cautionBg, border: DS.cautionBorder, text: DS.caution   },
    solid:   { bg: DS.caution,   border: DS.caution,       text: "#fff"       },
    outline: { bg: "transparent",border: DS.cautionBorder, text: DS.caution   },
  },
  bad: {
    soft:    { bg: DS.bannedBg,  border: DS.bannedBorder,  text: DS.banned    },
    solid:   { bg: DS.banned,    border: DS.banned,         text: "#fff"       },
    outline: { bg: "transparent",border: DS.bannedBorder,  text: DS.banned    },
  },
  // "brand" maps old callers who passed tone="info" or want the brand accent
  brand: {
    soft:    { bg: DS.brandBg,   border: DS.brandBorder,   text: DS.brand     },
    solid:   { bg: DS.brand,     border: DS.brand,          text: "#fff"       },
    outline: { bg: "transparent",border: DS.brandBorder,   text: DS.brand     },
  },
  // keep "info" as alias for brand so existing callers don't break
  info: {
    soft:    { bg: DS.brandBg,   border: DS.brandBorder,   text: DS.brand     },
    solid:   { bg: DS.brand,     border: DS.brand,          text: "#fff"       },
    outline: { bg: "transparent",border: DS.brandBorder,   text: DS.brand     },
  },
  dark: {
    soft:    { bg: DS.bodyText,  border: DS.bodyText,      text: "#fff"       },
    solid:   { bg: "#000",       border: "#000",            text: "#fff"       },
    outline: { bg: "transparent",border: DS.bodyText,      text: DS.bodyText  },
  },
};

const SIZES = {
  xs: { padding: "2px 7px",  fontSize: "10px" },
  sm: { padding: "3px 8px",  fontSize: "11px" },
  md: { padding: "4px 10px", fontSize: "12px" },
};

export default function Pill({
  children,
  tone     = "neutral",
  variant  = "soft",     // soft | solid | outline
  size     = "sm",       // xs | sm | md
  truncate = false,
  className = "",
  as: Comp = "span",
  title,
  style = {},
}) {
  const toneKey   = TONES[tone]            ? tone    : "neutral";
  const variantKey= TONES[toneKey][variant]? variant : "soft";
  const sizeKey   = SIZES[size]            ? size    : "sm";

  const c = TONES[toneKey][variantKey];
  const s = SIZES[sizeKey];

  return (
    <Comp
      title={title}
      className={className}
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            "4px",
        fontWeight:     700,
        lineHeight:     1,
        letterSpacing:  "0.03em",
        whiteSpace:     "nowrap",
        maxWidth:       "100%",
        overflow:       truncate ? "hidden" : undefined,
        textOverflow:   truncate ? "ellipsis" : undefined,
        backgroundColor: c.bg,
        border:         `1px solid ${c.border}`,
        color:          c.text,
        ...s,
        ...style,
      }}
    >
      {children}
    </Comp>
  );
}