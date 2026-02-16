// components/athlete-today/nutrition/sections/SupplementsPanel.jsx
"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Pill as PillIcon,
  Shield,
  Info,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { cx, safeText } from "../helpers";

/**
 * Spacing fixes:
 * ✅ consistent vertical rhythm (no cramped header / giant gaps)
 * ✅ mobile-safe wrapping (no accidental second lines pushing layout)
 * ✅ tighten chip + icon alignment
 * ✅ consistent paddings across inner cards
 */

function SectionCard({ children, className = "" }) {
  return (
    <div
      className={cx(
        "relative rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden",
        className
      )}
    >
      {/* subtle top accent */}
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

function ItemCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 min-w-0">
      <p className="text-[11px] text-gray-500 font-semibold leading-none truncate">
        {label}
      </p>
      <p className="text-sm font-extrabold text-gray-900 mt-2 leading-snug break-words whitespace-pre-wrap">
        {value}
      </p>
    </div>
  );
}

function EmptyCard() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-semibold text-gray-900 leading-snug">
        No supplement suggestions on this plan.
      </p>
      <p className="text-[12px] text-gray-600 mt-2 leading-snug">
        If you’re considering something, ask your coach first — especially if you’re drug-tested.
      </p>
    </div>
  );
}

function NotesCard({ text }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-gray-500 font-semibold leading-none">
          Supplement notes
        </p>
        <TinyChip tone="soft" className="shrink-0">
          <Info className="w-3.5 h-3.5" />
          Read
        </TinyChip>
      </div>

      <p className="text-sm text-gray-800 mt-3 leading-relaxed whitespace-pre-wrap break-words">
        {text}
      </p>
    </div>
  );
}

function SafetyCallout() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start gap-3">
        <span className="shrink-0 h-10 w-10 rounded-2xl border border-gray-200 bg-white flex items-center justify-center">
          <Shield className="w-5 h-5 text-gray-800" />
        </span>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-snug">
            Optional — verify quality
          </p>
          <p className="text-[12px] text-gray-700 mt-2 leading-snug">
            If you use supplements, prioritize{" "}
            <span className="font-semibold">third-party tested</span> options (e.g., NSF Certified for Sport) and follow your coach’s guidance.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-gray-600">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              Start simple
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              One change at a time
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Info className="w-3.5 h-3.5" />
              When in doubt: skip it
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupplementsPanel({
  open,
  onToggle,
  supplementItems,
  supplementNotes,
}) {
  const items = Array.isArray(supplementItems) ? supplementItems : [];
  const notes = safeText(supplementNotes);

  const hasItems = items.length > 0;
  const hasNotes = Boolean(notes);
  const hasAny = hasItems || hasNotes;

  const headerChip = useMemo(() => {
    if (!hasAny) {
      return (
        <TinyChip tone="soft">
          <PillIcon className="w-3.5 h-3.5" />
          None
        </TinyChip>
      );
    }
    if (hasItems && hasNotes) {
      return (
        <TinyChip tone="ok">
          <Sparkles className="w-3.5 h-3.5" />
          Items + notes
        </TinyChip>
      );
    }
    if (hasItems) {
      return (
        <TinyChip tone="ok">
          <PillIcon className="w-3.5 h-3.5" />
          {items.length} item{items.length === 1 ? "" : "s"}
        </TinyChip>
      );
    }
    return (
      <TinyChip tone="soft">
        <Info className="w-3.5 h-3.5" />
        Notes
      </TinyChip>
    );
  }, [hasAny, hasItems, hasNotes, items.length]);

  return (
    <SectionCard>
      {/* Header */}
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
              {/* Keep title + chip from awkward wrapping */}
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-extrabold text-gray-900 leading-tight">
                  Supplements
                </p>
                <span className="shrink-0">{headerChip}</span>
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

      {/* Body */}
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
              {/* Divider */}
              <div className="h-px w-full bg-gray-200" />

              {/* Items */}
              {hasItems ? (
                <div className="grid md:grid-cols-2 gap-3">
                  {items.map((it) => (
                    <ItemCard
                      key={String(it?.k ?? it?.label ?? Math.random())}
                      label={safeText(it?.label) || "Supplement"}
                      value={safeText(it?.value) || "—"}
                    />
                  ))}
                </div>
              ) : (
                <EmptyCard />
              )}

              {/* Notes */}
              {hasNotes ? <NotesCard text={notes} /> : null}

              {/* Safety reminder */}
              <SafetyCallout />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </SectionCard>
  );
}
