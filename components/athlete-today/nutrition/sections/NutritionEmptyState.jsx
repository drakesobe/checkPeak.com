"use client";

import { useMemo } from "react";
import {
  CalendarDays, RefreshCcw, ArrowRight,
  CheckCircle2, ShieldCheck,
} from "lucide-react";
import { safeText, fmtHumanDate } from "../helpers";

const C = {
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F8",
  brandBorder: "#C5D5E8",
};

function PrimaryButton({ onClick, children, disabled = false }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      style={{ backgroundColor: C.brand }}>
      {children}
    </button>
  );
}

function SecondaryButton({ onClick, children, disabled = false }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 transition disabled:opacity-60">
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
  const hasMsg  = Boolean(safeText(message));
  const nextEff = safeText(nextPlan?.effectiveDate);
  const title   = showUpcoming ? "Plan starts soon" : "No plan yet";

  const body = useMemo(() => {
    if (!showUpcoming) return "Your coach hasn't assigned a nutrition plan yet. Check back soon.";
    if (hasMsg)  return String(message);
    if (nextEff) return `No plan active for this date. Next plan starts ${fmtHumanDate(String(nextEff))}.`;
    return "No plan is active for this date.";
  }, [showUpcoming, hasMsg, message, nextEff]);

  return (
    <div className="mt-4 space-y-3">

      {/* Main card */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
        style={{ borderTop: `3px solid ${C.brand}` }}>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <span className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: C.brandBg, border: `1px solid ${C.brandBorder}` }}>
              <CalendarDays className="w-4 h-4" style={{ color: C.brand }} />
            </span>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-extrabold text-gray-900">{title}</p>
                {showUpcoming && (
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 leading-none">
                    Upcoming
                  </span>
                )}
                {nextEff && (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none"
                    style={{ borderColor: C.brandBorder, backgroundColor: C.brandBg, color: C.brand }}>
                    <CalendarDays className="w-3 h-3" />
                    Starts {fmtHumanDate(String(nextEff))}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1.5 leading-snug">{body}</p>
              <p className="text-[11px] text-gray-500 mt-1">
                Nutrition targets are guidance, not mandatory like workouts.
              </p>
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

          {/* What to do now */}
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">What you can do right now</p>
            <div className="space-y-2 text-[12px] text-gray-700">
              {[
                "Build meals around a protein anchor + a training carb.",
                "Keep hydration steady — a measured bottle makes it automatic.",
                "Aim for repeatable portions, not perfect labels.",
              ].map((line) => (
                <div key={line} className="flex items-start gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="min-w-0">{line}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hint card */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: `1px solid ${C.brandBorder}`, backgroundColor: C.brandBg }}>
        <div className="p-4 flex items-start gap-3">
          <span className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "#fff", border: `1px solid ${C.brandBorder}` }}>
            <ShieldCheck className="w-4 h-4" style={{ color: C.brand }} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: C.brand }}>How to use this</p>
            <p className="text-sm mt-1 leading-snug" style={{ color: `${C.brand}cc` }}>
              Targets are guidance. Focus on{" "}
              <span className="font-semibold">protein</span>,{" "}
              <span className="font-semibold">hydration</span>, and{" "}
              <span className="font-semibold">consistent portions</span>. That covers 80% of the plan.
            </p>
            {showUpcoming && (
              <p className="text-[11px] mt-2" style={{ color: `${C.brand}99` }}>
                Seeing "No plan yet" for multiple days? Ask your coach to set the plan effective date.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}