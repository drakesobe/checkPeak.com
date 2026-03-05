// /components/dashboard/SavedStacksCard.jsx
"use client";

import { Layers, Sparkles, ChevronRight, Settings2 } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

const BRAND     = "#5B9EC9";
const FONT_COND = "'Barlow Condensed', sans-serif";
const FONT_BODY = "'Barlow', sans-serif";

/* -------------------------------------------------------------------------- */
/* Avatar — initial letter with consistent brand tint                         */
/* -------------------------------------------------------------------------- */

function StackAvatar({ title }) {
  const letter = String(title?.[0] || "S").toUpperCase();
  return (
    <div
      className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-black"
      style={{
        background: "rgba(91,158,201,0.1)",
        border:     "1px solid rgba(91,158,201,0.2)",
        color:      BRAND,
        fontFamily: FONT_COND,
      }}
      aria-hidden="true"
    >
      {letter}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* CategoryPill                                                                */
/* -------------------------------------------------------------------------- */

function CategoryPill({ label }) {
  if (!label) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold mt-1"
      style={{
        background: "rgba(91,158,201,0.08)",
        border:     "1px solid rgba(91,158,201,0.18)",
        color:      "#1e6fa3",
        fontFamily: FONT_COND,
        letterSpacing: "0.03em",
      }}
    >
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* StackRow                                                                    */
/* -------------------------------------------------------------------------- */

function StackRow({ stack, idx }) {
  const title = stack.StackName || stack.Name || stack.name || "Saved stack";
  const note  = stack.Notes || stack.note || "Saved from SmartStack.";
  const cat   = stack.Category || stack.category || stack.Type || null;

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-3 transition-all"
      style={{
        background:  "#f8fafc",
        border:      "1px solid #f1f5f9",
        borderLeft:  `3px solid rgba(91,158,201,0.35)`,
      }}
    >
      <StackAvatar title={title} />

      <div className="flex flex-col min-w-0 flex-1">
        <p
          className="text-sm font-bold truncate leading-tight"
          style={{ color: "#0f172a", fontFamily: FONT_COND }}
        >
          {title}
        </p>
        <p
          className="text-[11px] line-clamp-1 mt-0.5"
          style={{ color: "#64748b" }}
        >
          {note}
        </p>
        <CategoryPill label={cat} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading skeleton                                                            */
/* -------------------------------------------------------------------------- */

function LoadingSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl px-3 py-3"
          style={{
            background: "#f8fafc",
            border:     "1px solid #f1f5f9",
            borderLeft: "3px solid #e2e8f0",
          }}
        >
          <div className="w-9 h-9 rounded-xl bg-slate-200 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 rounded-full bg-slate-200 w-2/3" />
            <div className="h-2.5 rounded-full bg-slate-100 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                 */
/* -------------------------------------------------------------------------- */

function EmptyState({ onExplore }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-xl py-8 px-5 text-center"
      style={{ background: "#f8fafc", border: "1px dashed #e2e8f0" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{
          background: "rgba(91,158,201,0.08)",
          border:     "1px solid rgba(91,158,201,0.18)",
        }}
        aria-hidden="true"
      >
        <Layers className="w-5 h-5" style={{ color: BRAND }} />
      </div>

      <div>
        <p className="text-sm font-bold" style={{ color: "#334155", fontFamily: FONT_COND }}>
          No stacks saved yet
        </p>
        <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "#64748b" }}>
          Save stacks from SmartStack to track ingredients you trust.
        </p>
      </div>

      <button
        type="button"
        onClick={onExplore}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all"
        style={{
          background:    BRAND,
          color:         "#fff",
          fontFamily:    FONT_COND,
          letterSpacing: "0.05em",
          boxShadow:     "0 2px 8px rgba(91,158,201,0.28)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#4a8ab5";
          e.currentTarget.style.boxShadow  = "0 4px 12px rgba(91,158,201,0.38)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = BRAND;
          e.currentTarget.style.boxShadow  = "0 2px 8px rgba(91,158,201,0.28)";
        }}
      >
        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
        Explore SmartStack
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SavedStacksCard                                                             */
/* -------------------------------------------------------------------------- */

export default function SavedStacksCard({
  stacks = [],
  loading = false,
  onManage,
  onExplore,
}) {
  const count   = stacks.length;
  const visible = stacks.slice(0, 5);

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
            <Layers className="w-3.5 h-3.5" style={{ color: BRAND }} aria-hidden="true" />
          </div>

          <div>
            <p
              className="text-[11px] font-bold uppercase tracking-widest leading-none"
              style={{ color: "#64748b", fontFamily: FONT_COND }}
            >
              Saved stacks
            </p>
            {!loading && count > 0 && (
              <p className="text-[11px] mt-0.5 leading-none" style={{ color: "#94a3b8" }}>
                {count} stack{count !== 1 ? "s" : ""} saved
              </p>
            )}
          </div>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-2">
          {!loading && count > 0 && (
            <>
              <button
                type="button"
                onClick={onExplore}
                className="inline-flex items-center gap-1 text-[11px] font-bold transition-colors"
                style={{ color: "#64748b", fontFamily: FONT_COND, letterSpacing: "0.04em" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = BRAND; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; }}
              >
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                Explore
              </button>

              <div
                className="w-px h-3 shrink-0"
                style={{ background: "#e2e8f0" }}
                aria-hidden="true"
              />

              <button
                type="button"
                onClick={onManage}
                className="inline-flex items-center gap-1 text-[11px] font-bold transition-colors"
                style={{ color: BRAND, fontFamily: FONT_COND, letterSpacing: "0.04em" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#2d6fa3"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = BRAND; }}
              >
                Manage
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-4 space-y-2">
        {loading ? (
          <LoadingSkeleton />
        ) : count === 0 ? (
          <EmptyState onExplore={onExplore} />
        ) : (
          <>
            {visible.map((stack, idx) => (
              <StackRow key={stack.id || idx} stack={stack} idx={idx} />
            ))}

            {count > 5 && (
              <button
                type="button"
                onClick={onManage}
                className="w-full text-center text-[11px] font-bold py-2 rounded-xl transition-all"
                style={{
                  color:         BRAND,
                  fontFamily:    FONT_COND,
                  background:    "rgba(91,158,201,0.05)",
                  border:        "1px solid rgba(91,158,201,0.15)",
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
                Show {count - 5} more stack{count - 5 !== 1 ? "s" : ""} →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}