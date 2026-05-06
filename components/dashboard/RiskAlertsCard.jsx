// /components/dashboard/RiskAlertsCard.jsx
"use client";

import { AlertTriangle, ShieldCheck, ChevronRight } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

const BRAND     = "#5B9EC9";
const FONT_COND = "'Barlow Condensed', sans-serif";
const FONT_BODY = "'Barlow', sans-serif";

/* -------------------------------------------------------------------------- */
/* RiskAlertsCard                                                              */
/* -------------------------------------------------------------------------- */

export default function RiskAlertsCard({ flaggedCount = 0, onReview }) {
  const isClear = flaggedCount === 0;

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background:  "#fff",
        border:      "1px solid #e2e8f0",
        borderTop:   isClear
          ? "3px solid rgba(91,158,201,0.6)"
          : "3px solid #f59e0b",
        boxShadow:   "0 1px 4px rgba(0,0,0,0.06)",
        fontFamily:  FONT_BODY,
      }}
    >
      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: isClear
                ? "rgba(91,158,201,0.1)"
                : "rgba(245,158,11,0.1)",
              border: isClear
                ? "1px solid rgba(91,158,201,0.2)"
                : "1px solid rgba(245,158,11,0.25)",
            }}
          >
            {isClear
              ? <ShieldCheck className="w-3.5 h-3.5" style={{ color: BRAND }} aria-hidden="true" />
              : <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#d97706" }} aria-hidden="true" />
            }
          </div>

          <p
            className="text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "#64748b", fontFamily: FONT_COND }}
          >
            Risk & alerts
          </p>
        </div>

        {/* ── State content ── */}
        {isClear ? <ClearState /> : <FlaggedState count={flaggedCount} onReview={onReview} />}
      </div>

      {/* ── Disclaimer - full width footer strip ── */}
      <div
        className="mt-auto px-5 py-3 flex items-start gap-2"
        style={{ background: "#f8fafc", borderTop: "1px solid #f1f5f9" }}
      >
        <span
          className="text-[11px] leading-relaxed"
          style={{ color: "#64748b" }}
        >
          CheckPeak does not replace official anti-doping rulings or medical advice. Always verify with your governing body.
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ClearState                                                                  */
/* -------------------------------------------------------------------------- */

function ClearState() {
  return (
    <div className="flex flex-col gap-3">

      {/* Big clear signal */}
      <div
        className="rounded-xl px-4 py-4 flex items-center gap-4"
        style={{
          background: "rgba(91,158,201,0.05)",
          border:     "1px solid rgba(91,158,201,0.15)",
        }}
      >
        {/* Shield - no glow, the "All clear" headline does the work */}
        <div
          className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: "rgba(91,158,201,0.08)",
            border:     "2px solid rgba(91,158,201,0.2)",
          }}
          aria-hidden="true"
        >
          <ShieldCheck
            className="w-6 h-6"
            style={{ color: BRAND }}
          />
        </div>

        <div>
          <p
            className="text-xl font-black leading-none"
            style={{ color: "#0f172a", fontFamily: FONT_COND }}
          >
            All clear
          </p>
          <p
            className="text-xs mt-1 leading-snug"
            style={{ color: "#64748b" }}
          >
            No flagged substances detected across your scans.
          </p>
        </div>
      </div>

      {/* Supporting note */}
      <p
        className="text-[11px] leading-relaxed"
        style={{ color: "#94a3b8" }}
      >
        Keep scanning new supplements before use - formulations change.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* FlaggedState                                                                */
/* -------------------------------------------------------------------------- */

function FlaggedState({ count, onReview }) {
  return (
    <div className="flex flex-col gap-3">

      {/* Alert block */}
      <div
        className="rounded-xl px-4 py-4 flex items-center gap-4"
        style={{
          background: "rgba(245,158,11,0.06)",
          border:     "1px solid rgba(245,158,11,0.25)",
        }}
      >
        {/* Count badge */}
        <div
          className="shrink-0 w-12 h-12 rounded-full flex flex-col items-center justify-center"
          style={{
            background: "rgba(245,158,11,0.12)",
            border:     "2px solid rgba(245,158,11,0.3)",
            boxShadow:  "0 0 16px rgba(245,158,11,0.15)",
          }}
          aria-hidden="true"
        >
          <span
            className="text-2xl font-black leading-none tabular-nums"
            style={{ color: "#d97706", fontFamily: FONT_COND }}
          >
            {count}
          </span>
        </div>

        <div>
          <p
            className="text-xl font-black leading-none"
            style={{ color: "#78350f", fontFamily: FONT_COND }}
          >
            {count === 1 ? "1 flagged scan" : `${count} flagged scans`}
          </p>
          <p
            className="text-xs mt-1 leading-snug"
            style={{ color: "#92400e" }}
          >
            {count === 1
              ? "This supplement may contain a banned or risky ingredient."
              : "These supplements may contain banned or risky ingredients."}
          </p>
        </div>
      </div>

      {/* CTA - firm but composed, not a fire alarm */}
      <button
        type="button"
        onClick={onReview}
        className="w-full flex items-center justify-between rounded-xl px-4 py-3 transition-all"
        style={{
          background:    "#fff",
          border:        "1.5px solid rgba(217,119,6,0.5)",
          color:         "#b45309",
          fontFamily:    FONT_COND,
          letterSpacing: "0.05em",
          cursor:        "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background   = "rgba(245,158,11,0.06)";
          e.currentTarget.style.borderColor  = "#d97706";
          e.currentTarget.style.color        = "#92400e";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background   = "#fff";
          e.currentTarget.style.borderColor  = "rgba(217,119,6,0.5)";
          e.currentTarget.style.color        = "#b45309";
        }}
        aria-label={`Review ${count} flagged scan${count === 1 ? "" : "s"}`}
      >
        <span className="text-sm font-bold">Review flagged scans</span>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>

      {/* Urgency note */}
      <p
        className="text-[11px] leading-relaxed"
        style={{ color: "#b45309" }}
      >
        Do not use flagged supplements until reviewed. Check ingredient lists carefully.
      </p>
    </div>
  );
}