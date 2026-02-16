// components/athlete-today/nutrition/sections/CoachNotesPanel.jsx
"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  NotebookText,
  Info,
  Sparkles,
} from "lucide-react";
import { cx, safeText } from "../helpers";

/**
 * CoachNotesPanel
 * Mobile spacing + wrapping fixes:
 * ✅ no accidental 2-line chips (whitespace-nowrap)
 * ✅ header layout never “pushes” into weird wraps (flex-col on xs, row on sm+)
 * ✅ consistent vertical rhythm (gap + leading)
 * ✅ safe long text handling (break-words + whitespace-pre-wrap)
 */

function SectionCard({ children, className = "" }) {
  return (
    <div
      className={cx(
        "relative rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden",
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-60" />
      <div className="relative p-4 sm:p-5">{children}</div>
    </div>
  );
}

function IconBubble({ children }) {
  return (
    <span className="shrink-0 h-10 w-10 rounded-2xl border border-blue-100 bg-blue-50 flex items-center justify-center">
      {children}
    </span>
  );
}

function TinyChip({ children, tone = "soft", className = "" }) {
  const cls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-gray-200 bg-gray-100 text-gray-700";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1",
        "text-[11px] font-semibold leading-none whitespace-nowrap",
        cls,
        className
      )}
    >
      {children}
    </span>
  );
}

function NotesCard({ text }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="shrink-0 h-10 w-10 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center">
          <NotebookText className="w-5 h-5 text-gray-800" />
        </span>

        <div className="min-w-0 flex-1">
          {/* On mobile: stack label + chip so nothing squeezes into weird wraps */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-[11px] text-gray-500 font-semibold leading-none">
              Coach notes
            </p>
            <TinyChip tone="soft" className="w-fit">
              <Info className="w-3.5 h-3.5" />
              Guidance
            </TinyChip>
          </div>

          <p className="text-sm text-gray-800 mt-3 leading-relaxed whitespace-pre-wrap break-words">
            {text}
          </p>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-[12px] text-gray-800 font-semibold leading-snug">
              Use these as guardrails.
            </p>
            <p className="text-[12px] text-gray-600 mt-1 leading-snug">
              Keep it simple: protein + hydration + reasonable portions. Execute with consistency.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyCard() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-semibold text-gray-900 leading-snug">
        No coach notes on this plan.
      </p>
      <p className="text-[12px] text-gray-600 mt-2 leading-snug">
        If you’re unsure what to do, focus on the basics: hit protein each meal and stay on top of hydration.
      </p>
    </div>
  );
}

export default function CoachNotesPanel({ open, onToggle, coachNotes }) {
  const notes = safeText(coachNotes);
  const hasNotes = Boolean(notes);

  const headerChip = useMemo(() => {
    if (!hasNotes) {
      return (
        <TinyChip tone="soft">
          <Info className="w-3.5 h-3.5" />
          None
        </TinyChip>
      );
    }
    return (
      <TinyChip tone="ok">
        <Sparkles className="w-3.5 h-3.5" />
        View
      </TinyChip>
    );
  }, [hasNotes]);

  return (
    <SectionCard>
      <button
        type="button"
        onClick={onToggle}
        className={cx(
          "w-full text-left rounded-2xl",
          "focus:outline-none focus:ring-2 focus:ring-[#46769B]/25"
        )}
        aria-expanded={open}
      >
        {/* Mobile-safe header layout: stack meta under title, keep chevron pinned */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <IconBubble>
              <NotebookText className="w-5 h-5 text-[#46769B]" />
            </IconBubble>

            <div className="min-w-0 pt-[1px]">
              {/* On xs: title + chip stack; on sm+: row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 gap-1">
                <p className="text-sm font-extrabold text-gray-900 leading-tight">
                  Coach Notes
                </p>
                <span className="shrink-0 w-fit">{headerChip}</span>
              </div>

              <p className="text-xs text-gray-500 mt-1 leading-snug">
              </p>
            </div>
          </div>

          <span className="shrink-0 h-10 w-10 rounded-2xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition">
            {open ? (
              <ChevronUp className="w-5 h-5 text-gray-700" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-700" />
            )}
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="notes"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              <div className="h-px w-full bg-gray-200" />
              {hasNotes ? <NotesCard text={notes} /> : <EmptyCard />}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </SectionCard>
  );
}
