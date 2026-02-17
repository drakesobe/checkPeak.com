// components/athlete-today/nutrition/sections/SupplementsPanel.jsx
"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Pill as PillIcon, Info, Sparkles, Shield } from "lucide-react";
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

function ItemCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 min-w-0">
      <p className="text-[11px] text-gray-500 font-semibold leading-none truncate">{label}</p>
      <p className="text-sm font-extrabold text-gray-900 mt-2 leading-snug break-words whitespace-pre-wrap">
        {value}
      </p>
    </div>
  );
}

function EmptyBody() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-semibold text-gray-900">No supplements</p>
      <p className="text-[12px] text-gray-600 mt-1 leading-snug">
        If you’re drug-tested, ask your coach before adding anything.
      </p>
    </div>
  );
}

function NotesBody({ text }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">{text}</p>
    </div>
  );
}

function SafetyLine() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-[12px] text-gray-700 inline-flex items-center gap-2">
        <Shield className="w-4 h-4 text-gray-700" />
        Prefer third-party tested options (e.g., NSF Certified for Sport).
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function SupplementsPanel({ open, onToggle, supplementItems, supplementNotes }) {
  const items = Array.isArray(supplementItems) ? supplementItems : [];
  const notes = safeText(supplementNotes);

  const hasItems = items.length > 0;
  const hasNotes = Boolean(notes);
  const hasAny = hasItems || hasNotes;

  const countLabel = useMemo(() => {
    if (!hasItems) return "";
    return `${items.length} item${items.length === 1 ? "" : "s"}`;
  }, [hasItems, items.length]);

  const preview = useMemo(() => {
    if (!hasAny) return "No supplements on this plan.";
    if (hasItems) {
      const first = items[0];
      const label = safeText(first?.label) || "Supplement";
      const value = safeText(first?.value);
      const shortVal = value ? value.replace(/\s+/g, " ").slice(0, 70) : "";
      return `${label}${shortVal ? ` — ${shortVal}` : ""}`;
    }
    return firstLinePreview(notes) || "Supplement notes available.";
  }, [hasAny, hasItems, items, notes]);

  const statusChip = useMemo(() => {
    if (!hasAny) {
      return (
        <Chip tone="neutral">
          <Info className="w-3.5 h-3.5" />
          None
        </Chip>
      );
    }
    if (hasItems && hasNotes) {
      return (
        <Chip tone="ok">
          <Sparkles className="w-3.5 h-3.5" />
          {countLabel} + notes
        </Chip>
      );
    }
    if (hasItems) {
      return (
        <Chip tone="ok">
          <PillIcon className="w-3.5 h-3.5" />
          {countLabel}
        </Chip>
      );
    }
    return (
      <Chip tone="blue">
        <Info className="w-3.5 h-3.5" />
        Notes
      </Chip>
    );
  }, [hasAny, hasItems, hasNotes, countLabel]);

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
              <PillIcon className="w-5 h-5 text-[#46769B]" />
            </IconBubble>

            <div className="min-w-0 pt-[1px]">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-extrabold text-gray-900 leading-tight">Supplements</p>
                <span className="shrink-0">{statusChip}</span>
              </div>

              {/* Closed: show preview line only (less noise). Open: hide it. */}
              {!open ? (
                <p className="text-[12px] text-gray-500 mt-1 leading-snug truncate">
                  {preview}
                </p>
              ) : null}
            </div>
          </div>

          <span className="shrink-0 h-10 w-10 rounded-2xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition">
            {open ? <ChevronUp className="w-5 h-5 text-gray-700" /> : <ChevronDown className="w-5 h-5 text-gray-700" />}
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="supp"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              <div className="h-px w-full bg-gray-200" />

              {hasItems ? (
                <div className="grid md:grid-cols-2 gap-3">
                  {items.map((it, idx) => {
                    const key = String(it?.k ?? it?.label ?? idx);
                    return (
                      <ItemCard
                        key={key}
                        label={safeText(it?.label) || "Supplement"}
                        value={safeText(it?.value) || "—"}
                      />
                    );
                  })}
                </div>
              ) : (
                <EmptyBody />
              )}

              {hasNotes ? <NotesBody text={notes} /> : null}

              {/* Quiet safety reminder (small, not a whole lecture) */}
              {hasAny ? <SafetyLine /> : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </SectionCard>
  );
}
