"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, NotebookText, Info } from "lucide-react";
import { cx, safeText } from "../helpers";

/* -------------------------------------------------------------------------- */
/* Tiny UI                                                                    */
/* -------------------------------------------------------------------------- */

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

function Chip({ children, tone = "neutral", className = "" }) {
  const cls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-900"
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

function firstLinePreview(text) {
  const s = String(text || "").trim();
  if (!s) return "";
  const line = s.split("\n").find(Boolean) || s;
  return line.replace(/\s+/g, " ").slice(0, 120);
}

function NotesBody({ text }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
        {text}
      </p>
    </div>
  );
}

function EmptyBody() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-semibold text-gray-900">No coach notes</p>
      <p className="text-[12px] text-gray-600 mt-1 leading-snug">
        Keep it simple: protein each meal + hydration.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function CoachNotesPanel({ open, onToggle, coachNotes }) {
  const notes = safeText(coachNotes);
  const hasNotes = Boolean(notes);
  const preview = useMemo(() => firstLinePreview(notes), [notes]);

  // ✅ simplified: no sparkle, no "Notes" chip
  const statusChip = useMemo(() => {
    if (!hasNotes) {
      return (
        <Chip tone="neutral">
          <Info className="w-3.5 h-3.5" />
          None
        </Chip>
      );
    }
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
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <IconBubble>
              <NotebookText className="w-5 h-5 text-[#46769B]" />
            </IconBubble>

            <div className="min-w-0 pt-[1px]">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-extrabold text-gray-900 leading-tight">
                  Coach Notes
                </p>
                <span className="shrink-0">{statusChip}</span>
              </div>

              {/* Closed: show a single preview line (no extra noise). Open: hide this. */}
              {!open ? (
                <p className="text-[12px] text-gray-500 mt-1 leading-snug truncate">
                  {hasNotes ? preview : "No notes on this plan."}
                </p>
              ) : null}
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
            <div className="mt-4">
              <div className="h-px w-full bg-gray-200 mb-3" />
              {hasNotes ? <NotesBody text={notes} /> : <EmptyBody />}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </SectionCard>
  );
}
