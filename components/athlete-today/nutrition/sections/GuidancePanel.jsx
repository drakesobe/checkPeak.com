"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Info, CheckCircle2, Droplets, Beef, Wheat } from "lucide-react";
import { cx } from "../helpers";

/**
 * GuidancePanel (Collapsible)
 * - Works controlled OR uncontrolled:
 *   - Controlled: pass `open` + `onToggle`
 *   - Uncontrolled: omit them, it manages itself
 *
 * Props:
 *  - open?: boolean
 *  - onToggle?: () => void
 */
export default function GuidancePanel({ open, onToggle }) {
  const isControlled = typeof open === "boolean" && typeof onToggle === "function";
  const [localOpen, setLocalOpen] = useState(false);

  const isOpen = isControlled ? open : localOpen;

  const toggle = () => {
    if (isControlled) onToggle();
    else setLocalOpen((v) => !v);
  };

  const contentAnim = useMemo(
    () => ({
      initial: { height: 0, opacity: 0 },
      animate: { height: "auto", opacity: 1 },
      exit: { height: 0, opacity: 0 },
      transition: { duration: 0.16 },
    }),
    []
  );

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/70 shadow-sm overflow-hidden relative">
      {/* IMPORTANT: must not block clicks */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-60" />

      <button
        type="button"
        onClick={toggle}
        className={cx(
          "w-full text-left px-4 sm:px-5 py-4 sm:py-5",
          "hover:bg-blue-50/60",
          "focus:outline-none focus:ring-2 focus:ring-[#46769B]/25"
        )}
        aria-expanded={isOpen}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="shrink-0 h-10 w-10 rounded-2xl border border-blue-200 bg-white/70 flex items-center justify-center">
                <Info className="w-5 h-5 text-[#46769B]" />
              </span>

              <div className="min-w-0">
                <p className="text-sm font-extrabold text-blue-900 leading-snug">Simple daily approach</p>
                <p className="text-[12px] text-blue-900/80 mt-1 leading-snug">
                  Targets are guidance — hit the big rocks consistently.
                </p>
              </div>
            </div>
          </div>

          <span className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-2xl border border-blue-200 bg-white/60">
            {isOpen ? (
              <ChevronUp className="w-5 h-5 text-blue-900/70" />
            ) : (
              <ChevronDown className="w-5 h-5 text-blue-900/70" />
            )}
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div key="guidance" {...contentAnim} className="overflow-hidden">
            <div className="px-4 sm:px-5 pb-4 sm:pb-5">
              <div className="h-px w-full bg-blue-200/60" />

              <div className="mt-4 space-y-3 text-sm text-blue-900/85">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 h-6 w-6 rounded-xl border border-blue-200 bg-white/70 flex items-center justify-center">
                    <Beef className="w-4 h-4 text-blue-900" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-blue-900">Protein at every meal</p>
                    <p className="text-[13px] leading-snug">
                      Treat protein as the anchor. Close counts — get a solid serving each meal.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 h-6 w-6 rounded-xl border border-blue-200 bg-white/70 flex items-center justify-center">
                    <Droplets className="w-4 h-4 text-blue-900" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-blue-900">Hydration stays steady</p>
                    <p className="text-[13px] leading-snug">
                      Use the per-meal water target as your anchor. Catch up gradually.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 h-6 w-6 rounded-xl border border-blue-200 bg-white/70 flex items-center justify-center">
                    <Wheat className="w-4 h-4 text-blue-900" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-blue-900">Carbs with purpose</p>
                    <p className="text-[13px] leading-snug">
                      Put carbs around lifts/practice. Don’t stress exact labels.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-blue-200 bg-white/60 p-3 sm:p-4">
                <p className="text-[11px] uppercase tracking-wide font-extrabold text-blue-900/90">Fast checklist</p>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                    <p className="text-[13px] text-blue-900/85 leading-snug">Protein first, then everything else.</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                    <p className="text-[13px] text-blue-900/85 leading-snug">Hit water target every meal.</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                    <p className="text-[13px] text-blue-900/85 leading-snug">Missed one? Next rep, no spiral.</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                    <p className="text-[13px] text-blue-900/85 leading-snug">Consistency beats perfect tracking.</p>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-[11px] text-blue-900/70 leading-snug">
                Tip: default to protein + water when unsure.
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
