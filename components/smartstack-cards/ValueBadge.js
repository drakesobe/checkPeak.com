"use client";

import Tooltip from "./Tooltip";

const STYLE_MAP = {
  "Best Value": {
    bg: "rgba(34,197,94,0.14)",
    border: "rgba(34,197,94,0.32)",
    text: "#86efac",
    score: "rgba(134,239,172,0.78)",
  },
  "Good Value": {
    bg: "rgba(91,158,201,0.16)",
    border: "rgba(91,158,201,0.34)",
    text: "#7cc6f3",
    score: "rgba(124,198,243,0.78)",
  },
  "Decent Value": {
    bg: "rgba(251,191,36,0.14)",
    border: "rgba(251,191,36,0.30)",
    text: "#fcd34d",
    score: "rgba(252,211,77,0.76)",
  },
  "Value N/A": {
    bg: "rgba(148,163,184,0.12)",
    border: "rgba(148,163,184,0.24)",
    text: "rgba(226,232,240,0.78)",
    score: "rgba(226,232,240,0.55)",
  },
};

export default function ValueBadge({ valueScore, valueLabel }) {
  const label = valueLabel || "Value N/A";
  const theme = STYLE_MAP[label] || STYLE_MAP["Value N/A"];
  const hasScore = valueScore != null && !isNaN(valueScore);

  return (
    <Tooltip content="Value is compared against similar products in the same category.">
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
        style={{
          background: theme.bg,
          border: `1px solid ${theme.border}`,
          color: theme.text,
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: theme.text }}
          aria-hidden="true"
        />
        <span>{label}</span>
        {hasScore && (
          <span
            className="font-bold"
            style={{
              color: theme.score,
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: "0.03em",
            }}
          >
            {valueScore.toFixed(2)}
          </span>
        )}
      </span>
    </Tooltip>
  );
}