// components/athlete-today/nutrition/sections/NutritionEmptyState.jsx
"use client";

import { useMemo } from "react";
import {
  CalendarDays,
  Info,
  RefreshCcw,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { safeText, fmtHumanDate } from "../helpers";

/**
 * NutritionEmptyState
 * Goals:
 * ✅ Premium soft SaaS styling (matches your other nutrition sections)
 * ✅ Strong hierarchy: headline → explanation → next-plan date (if any) → actions
 * ✅ Mobile-safe wrapping (min-w-0, truncate, whitespace-nowrap where needed)
 * ✅ Adds “alive” feel: icon bubble, subtle accent bar, guidance checklist
 */

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function SoftCard({ children, className = "" }) {
  return (
    <div
      className={cx(
        "relative rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden",
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-70" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-blue-50/35 to-white/0" />
      <div className="relative p-4">{children}</div>
    </div>
  );
}

function HintCard({ children }) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 overflow-visible">
      {children}
    </div>
  );
}

function IconBubble({ children }) {
  return (
    <div className="shrink-0 h-10 w-10 rounded-2xl border border-blue-100 bg-blue-50 flex items-center justify-center">
      {children}
    </div>
  );
}

function PrimaryButton({ onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl",
        "bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 transition",
        disabled ? "opacity-70 cursor-not-allowed" : ""
      )}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl",
        "bg-white border border-gray-200 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition",
        disabled ? "opacity-70 cursor-not-allowed" : ""
      )}
    >
      {children}
    </button>
  );
}

export default function NutritionEmptyState({
  showUpcoming,
  message,
  nextPlan,
  onOpenNutrition,
  onRefresh,
}) {
  const hasMsg = Boolean(safeText(message));
  const nextEff = safeText(nextPlan?.effectiveDate);

  const title = showUpcoming ? "Plan starts soon" : "No plan yet";

  const body = useMemo(() => {
    if (!showUpcoming) {
      return "Your coach hasn’t assigned a nutrition plan. Check back soon.";
    }

    if (hasMsg) return String(message);

    if (nextEff) {
      return `No plan is effective for this date. Next plan starts ${fmtHumanDate(String(nextEff))}.`;
    }

    return "No plan is effective for this date.";
  }, [showUpcoming, hasMsg, message, nextEff]);

  return (
    <div className="mt-4 space-y-3">
      {/* Main empty state card */}
      <SoftCard>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <IconBubble>
              <CalendarDays className="w-5 h-5 text-[#46769B]" />
            </IconBubble>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-extrabold text-gray-900 truncate">{title}</p>

                {showUpcoming ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                    <Sparkles className="w-3.5 h-3.5" />
                    Upcoming
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                    <Info className="w-3.5 h-3.5" />
                    Suggested
                  </span>
                )}

                {nextEff ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-900">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Starts {fmtHumanDate(String(nextEff))}
                  </span>
                ) : null}
              </div>

              <p className="text-sm text-gray-600 mt-1">
                {showUpcoming && !hasMsg && nextEff ? (
                  <>
                    No plan is effective for this date.{" "}
                    <span className="font-semibold text-gray-800">
                      Next plan starts {fmtHumanDate(String(nextEff))}
                    </span>
                    .
                  </>
                ) : (
                  body
                )}
              </p>

              <p className="text-[11px] text-gray-500 mt-2">
                Nutrition targets are guidance — not mandatory like workouts.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <SecondaryButton onClick={onOpenNutrition}>
            Open Nutrition
            <ArrowRight className="w-4 h-4" />
          </SecondaryButton>

          <PrimaryButton onClick={onRefresh}>
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </PrimaryButton>
        </div>

        {/* Subtle “next steps” strip */}
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">What you can do right now</p>

          <div className="mt-2 grid gap-2 text-[12px] text-gray-700">
            <div className="flex items-start gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <p className="min-w-0">
                If you’re on campus, build meals around a{" "}
                <span className="font-semibold">protein anchor</span> + a carb that supports training.
              </p>
            </div>

            <div className="flex items-start gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <p className="min-w-0">
                Keep hydration steady. A bottle with measured ounces makes this automatic.
              </p>
            </div>

            <div className="flex items-start gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <p className="min-w-0">
                Don’t chase perfect labels — aim for{" "}
                <span className="font-semibold">repeatable portions</span> you can execute daily.
              </p>
            </div>
          </div>
        </div>
      </SoftCard>

      {/* Guidance card */}
      <HintCard>
        <div className="flex items-start gap-3">
          <div className="shrink-0 h-10 w-10 rounded-2xl border border-blue-200 bg-white/70 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-blue-900" />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-900">How to use this</p>
            <p className="text-sm text-blue-900/80 mt-1">
              Targets are guidance — not “mandatory” like workouts. Focus on the big rocks:
              <span className="font-semibold"> protein</span>, <span className="font-semibold">hydration</span>,
              and <span className="font-semibold">reasonable portions</span>. If you do those consistently, you’re winning.
            </p>

            <p className="text-[11px] text-blue-900/70 mt-2">
              Tip: If you’re seeing “No plan yet” for multiple days, ask your coach to publish a plan effective date.
            </p>
          </div>
        </div>
      </HintCard>
    </div>
  );
}
