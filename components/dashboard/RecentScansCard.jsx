// /components/dashboard/RecentScansCard.jsx
"use client";

import { AlertTriangle, ChevronRight, ScanLine } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

const BRAND     = "#5B9EC9";
const FONT_COND = "'Barlow Condensed', sans-serif";
const FONT_BODY = "'Barlow', sans-serif";

/* -------------------------------------------------------------------------- */
/* ScanRow                                                                     */
/* -------------------------------------------------------------------------- */

function ScanRow({ scan, formatDate, onOpen }) {
  const isFlagged = !!scan.hasBanned;

  return (
    <button
      type="button"
      onClick={() => onOpen(scan)}
      className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-all group"
      style={{
        background:   isFlagged ? "rgba(245,158,11,0.04)" : "#f8fafc",
        border:       isFlagged
          ? "1px solid rgba(245,158,11,0.2)"
          : "1px solid #f1f5f9",
        borderLeft:   isFlagged
          ? "3px solid #f59e0b"
          : `3px solid rgba(91,158,201,0.35)`,
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background   = isFlagged
          ? "rgba(245,158,11,0.07)"
          : "#f1f5f9";
        e.currentTarget.style.borderColor  = isFlagged ? "#d97706" : "#e2e8f0";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background   = isFlagged
          ? "rgba(245,158,11,0.04)"
          : "#f8fafc";
        e.currentTarget.style.borderColor  = isFlagged
          ? "rgba(245,158,11,0.2)"
          : "#f1f5f9";
      }}
      aria-label={`Open scan: ${scan.displayName}${isFlagged ? " - flagged" : ""}`}
    >
      {/* Status dot */}
      <div
        className="shrink-0 w-2 h-2 rounded-full"
        style={{
          background: isFlagged ? "#f59e0b" : "rgba(91,158,201,0.5)",
          boxShadow:  isFlagged
            ? "0 0 4px rgba(245,158,11,0.4)"
            : "none",
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-bold truncate leading-tight"
          style={{ color: "#0f172a", fontFamily: FONT_COND }}
        >
          {scan.displayName || "Unnamed scan"}
        </p>

        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <p
            className="text-[11px]"
            style={{ color: "#64748b" }}
          >
            {typeof formatDate === "function" && scan.parsedDate
              ? formatDate(scan.parsedDate)
              : "-"}
          </p>

          {isFlagged && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold"
              style={{ color: "#d97706", fontFamily: FONT_COND }}
              aria-label="Flagged"
            >
              <AlertTriangle className="w-3 h-3" aria-hidden="true" />
              Flagged
            </span>
          )}
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight
        className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5"
        style={{ color: isFlagged ? "#d97706" : "#94a3b8" }}
        aria-hidden="true"
      />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading skeleton                                                            */
/* -------------------------------------------------------------------------- */

function LoadingSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="rounded-xl px-3 py-3 flex items-center gap-3"
          style={{
            background:  "#f8fafc",
            border:      "1px solid #f1f5f9",
            borderLeft:  "3px solid #e2e8f0",
          }}
        >
          <div className="w-2 h-2 rounded-full bg-slate-200 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 rounded-full bg-slate-200 w-3/4" />
            <div className="h-2.5 rounded-full bg-slate-100 w-1/3" />
          </div>
          <div className="w-4 h-4 rounded bg-slate-100 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                 */
/* -------------------------------------------------------------------------- */

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-xl py-8"
      style={{ background: "#f8fafc", border: "1px dashed #e2e8f0" }}
    >
      <ScanLine className="w-6 h-6" style={{ color: "#cbd5e1" }} aria-hidden="true" />
      <p className="text-sm font-semibold" style={{ color: "#64748b" }}>
        No scans this week
      </p>
      <p className="text-[11px]" style={{ color: "#94a3b8" }}>
        Scan a supplement label to see your history here.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* RecentScansCard                                                             */
/* -------------------------------------------------------------------------- */

export default function RecentScansCard({
  scans = [],
  loading = false,
  formatDate,
  onOpen,
  onViewAll,
}) {
  const visible      = scans.slice(0, 5);
  const flaggedCount = scans.filter((s) => s.hasBanned).length;
  const hasScans     = scans.length > 0;

  return (
    <div
      className="rounded-2xl flex flex-col"
      style={{
        background: "#fff",
        border:     "1px solid #e2e8f0",
        boxShadow:  "0 1px 4px rgba(0,0,0,0.06)",
        fontFamily: FONT_BODY,
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid #f1f5f9" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: "rgba(91,158,201,0.1)",
              border:     "1px solid rgba(91,158,201,0.2)",
            }}
          >
            <ScanLine className="w-3.5 h-3.5" style={{ color: BRAND }} aria-hidden="true" />
          </div>

          <div>
            <p
              className="text-[11px] font-bold uppercase tracking-widest leading-none"
              style={{ color: "#64748b", fontFamily: FONT_COND }}
            >
              Recent scans
            </p>
            {!loading && hasScans && (
              <p className="text-[11px] mt-0.5 leading-none" style={{ color: "#94a3b8" }}>
                {scans.length} scan{scans.length !== 1 ? "s" : ""}
                {flaggedCount > 0 && (
                  <span style={{ color: "#d97706" }}>
                    {" "}· {flaggedCount} flagged
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {hasScans && !loading && (
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1 text-[11px] font-bold transition-colors shrink-0"
            style={{ color: BRAND, fontFamily: FONT_COND, letterSpacing: "0.04em" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#2d6fa3"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = BRAND; }}
          >
            View all
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ── Body ── */}
      <div className="p-4 space-y-2">
        {loading ? (
          <LoadingSkeleton />
        ) : !hasScans ? (
          <EmptyState />
        ) : (
          <>
            {visible.map((scan) => (
              <ScanRow
                key={scan.id}
                scan={scan}
                formatDate={formatDate}
                onOpen={onOpen}
              />
            ))}

            {scans.length > 5 && (
              <button
                type="button"
                onClick={onViewAll}
                className="w-full text-center text-[11px] font-bold py-2 rounded-xl transition-all"
                style={{
                  color:      BRAND,
                  fontFamily: FONT_COND,
                  background: "rgba(91,158,201,0.05)",
                  border:     "1px solid rgba(91,158,201,0.15)",
                  letterSpacing: "0.04em",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(91,158,201,0.1)";
                  e.currentTarget.style.color      = "#2d6fa3";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(91,158,201,0.05)";
                  e.currentTarget.style.color      = BRAND;
                }}
              >
                Show {scans.length - 5} more →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}