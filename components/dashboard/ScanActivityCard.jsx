// /components/dashboard/ScanActivityCard.jsx
"use client";

import { useState } from "react";
import { ChevronRight, ScanLine } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

const BRAND     = "#5B9EC9";
const FONT_COND = "'Barlow Condensed', sans-serif";
const FONT_BODY = "'Barlow', sans-serif";

/* -------------------------------------------------------------------------- */
/* ScanActivityCard                                                            */
/* -------------------------------------------------------------------------- */

export default function ScanActivityCard({
  data = [],
  max = 1,
  loading = false,
  lastScanDate = null,
  formatDate,
  onView,
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const hasData      = Array.isArray(data) && data.length > 0;
  const totalScans   = hasData ? data.reduce((sum, d) => sum + (d.count || 0), 0) : 0;
  const peakCount    = hasData ? Math.max(...data.map((d) => d.count || 0)) : 0;
  const activeDays   = hasData ? data.filter((d) => d.count > 0).length : 0;
  const safeMax      = Math.max(1, max);

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{
        background: "#fff",
        border:     "1px solid #e2e8f0",
        boxShadow:  "0 1px 4px rgba(0,0,0,0.06)",
        fontFamily: FONT_BODY,
      }}
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {/* Icon box */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "rgba(91,158,201,0.1)",
              border:     "1px solid rgba(91,158,201,0.2)",
            }}
          >
            <ScanLine className="w-4 h-4" style={{ color: BRAND }} aria-hidden="true" />
          </div>

          <div>
            <p
              className="text-[11px] font-bold uppercase tracking-widest leading-none"
              style={{ color: "#64748b", fontFamily: FONT_COND }}
            >
              Scan activity
            </p>
            <p
              className="text-xs mt-0.5 font-medium"
              style={{ color: "#94a3b8" }}
            >
              Last 7 days
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1 text-xs font-bold shrink-0 transition-colors"
          style={{ color: BRAND, fontFamily: FONT_COND, letterSpacing: "0.04em" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#2d6fa3"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = BRAND; }}
        >
          All scans
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* ── Summary pills ─────────────────────────────────────────────── */}
      {!loading && hasData && (
        <div className="flex items-center gap-2 flex-wrap">
          <SummaryPill label="This week" value={totalScans} unit={totalScans === 1 ? "scan" : "scans"} highlight />
          <SummaryPill label="Peak day"  value={peakCount}  unit={peakCount  === 1 ? "scan" : "scans"} />
          <SummaryPill label="Active"    value={activeDays} unit={activeDays  === 1 ? "day"  : "days"}  />
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────── */}
      {loading ? (
        <LoadingState />
      ) : !hasData ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-2">

          {/* Bar chart */}
          <div
            className="flex items-end gap-1.5 sm:gap-2"
            style={{ height: 96 }}
            role="img"
            aria-label={`Scan activity over the last 7 days. Total: ${totalScans} scans.`}
          >
            {data.map((day, idx) => {
              const ratio   = (day.count || 0) / safeMax;
              const barH    = day.count > 0 ? Math.max(12, Math.round(ratio * 80)) : 4;
              const isHover = hoveredIdx === idx;
              const isPeak  = day.count > 0 && day.count === peakCount;

              return (
                <div
                  key={day.key ?? idx}
                  className="flex flex-1 flex-col items-center gap-1 cursor-default"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  {/* Count label - shows on hover or peak */}
                  <div style={{ height: 16, display: "flex", alignItems: "flex-end" }}>
                    {(isHover || isPeak) && day.count > 0 && (
                      <span
                        className="text-[11px] font-black tabular-nums leading-none"
                        style={{
                          color:      isHover ? BRAND : "#64748b",
                          fontFamily: FONT_COND,
                        }}
                      >
                        {day.count}
                      </span>
                    )}
                  </div>

                  {/* Bar */}
                  <div
                    className="w-full rounded-sm transition-all duration-200"
                    style={{
                      height:     `${barH}px`,
                      background: day.count > 0
                        ? isHover
                          ? "#4a8ab5"
                          : isPeak
                          ? BRAND
                          : "rgba(91,158,201,0.45)"
                        : "#f1f5f9",
                      borderRadius: day.count > 0 ? "4px 4px 2px 2px" : "2px",
                      boxShadow:  isHover && day.count > 0
                        ? "0 2px 8px rgba(91,158,201,0.35)"
                        : "none",
                      transition: "height 0.3s ease, background 0.15s ease, box-shadow 0.15s ease",
                    }}
                    title={`${day.label}: ${day.count} scan${day.count === 1 ? "" : "s"}`}
                  />

                  {/* Day label */}
                  <span
                    className="text-[11px] font-semibold"
                    style={{
                      color:      day.count > 0
                        ? isHover ? BRAND : "#475569"
                        : "#94a3b8",
                      fontFamily: FONT_COND,
                      letterSpacing: "0.03em",
                    }}
                  >
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Last scan */}
          {lastScanDate && (
            <div
              className="flex items-center justify-between rounded-xl px-3 py-2"
              style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "#64748b", fontFamily: FONT_COND }}
              >
                Last scan
              </p>
              <p
                className="text-[11px] font-semibold"
                style={{ color: "#334155" }}
              >
                {typeof formatDate === "function" ? formatDate(lastScanDate) : String(lastScanDate)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SummaryPill                                                                 */
/* -------------------------------------------------------------------------- */

function SummaryPill({ label, value, unit, highlight = false }) {
  return (
    <div
      className="inline-flex items-baseline gap-1.5 rounded-lg px-2.5 py-1.5"
      style={{
        background: highlight ? "rgba(91,158,201,0.08)" : "#f8fafc",
        border:     highlight ? "1px solid rgba(91,158,201,0.2)" : "1px solid #e2e8f0",
      }}
    >
      <span
        className="text-base font-black tabular-nums leading-none"
        style={{ color: highlight ? BRAND : "#0f172a", fontFamily: FONT_COND }}
      >
        {value}
      </span>
      <span
        className="text-[11px] font-semibold"
        style={{ color: "#64748b" }}
      >
        {unit}
      </span>
      <span
        className="text-[11px]"
        style={{ color: "#94a3b8" }}
      >
        · {label}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading skeleton                                                            */
/* -------------------------------------------------------------------------- */

function LoadingState() {
  return (
    <div className="animate-pulse flex flex-col gap-3">
      {/* Pill skeletons */}
      <div className="flex gap-2">
        <div className="h-8 w-28 rounded-lg bg-slate-100" />
        <div className="h-8 w-24 rounded-lg bg-slate-100" />
      </div>
      {/* Bar skeletons */}
      <div className="flex items-end gap-1.5 h-24">
        {[60, 30, 75, 45, 90, 20, 55].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-slate-100"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                 */
/* -------------------------------------------------------------------------- */

function EmptyState() {
  return (
    <div
      className="h-28 flex flex-col items-center justify-center gap-2 rounded-xl"
      style={{ background: "#f8fafc", border: "1px dashed #e2e8f0" }}
    >
      <ScanLine className="w-6 h-6" style={{ color: "#cbd5e1" }} aria-hidden="true" />
      <p className="text-sm font-semibold" style={{ color: "#64748b" }}>
        No scans this week
      </p>
      <p className="text-xs" style={{ color: "#94a3b8" }}>
        Scan your first supplement label to see activity here.
      </p>
    </div>
  );
}