"use client";

import { useMemo } from "react";
import { RefreshCcw, CheckCircle2, Utensils } from "lucide-react";
import { cx, isISODateOnly, fmtHumanDate, pct } from "../helpers";

function TinyChip({ children, tone = "soft", className = "" }) {
  const toneCls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : tone === "blue"
      ? "bg-blue-50 text-blue-900 border-blue-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        "text-[11px] font-semibold leading-none whitespace-nowrap",
        toneCls,
        className
      )}
    >
      {children}
    </span>
  );
}

function ActionButton({ onClick, children, title = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl",
        "px-2.5 py-2 text-xs font-semibold whitespace-nowrap",
        "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 transition"
      )}
    >
      {children}
    </button>
  );
}

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function progressTone(pctVal, isComplete) {
  if (!pctVal) return "soft";
  if (isComplete || pctVal >= 100) return "ok";
  if (pctVal >= 50) return "blue";
  return "soft";
}

function MiniBar({ pctValue }) {
  const p = clampPct(pctValue);
  return (
    <div
      className="mt-2 h-1.5 w-full rounded-full bg-gray-100 border border-gray-200 overflow-hidden"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={p}
      aria-label="Nutrition completion progress"
    >
      <div className="h-full rounded-full bg-[#46769B] transition-all" style={{ width: `${p}%` }} />
    </div>
  );
}

export default function NutritionHeader({ subtitle, metaStatus, metaEff, counts, onRefresh }) {
  const done = Number(counts?.done || 0);
  const total = Number(counts?.total || 0);
  const pctRaw = clampPct(counts?.pct);
  const isComplete = total > 0 && done >= total;

  const tone = useMemo(() => progressTone(pctRaw, isComplete), [pctRaw, isComplete]);

  const progressLabel = useMemo(() => {
    if (!total) return "No items";
    return `${done}/${total} (${pct(pctRaw)})`;
  }, [done, total, pctRaw]);

  const effLine =
    metaEff && isISODateOnly(metaEff) ? (
      <p className="text-[11px] text-gray-500 leading-none">
        Effective: <span className="font-semibold text-gray-700">{fmtHumanDate(metaEff)}</span>
      </p>
    ) : null;

  return (
    <div className="rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-50" />

      {/* tighter padding on mobile */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          {/* Left */}
          <div className="min-w-0 flex items-start gap-3">
            {/* slightly smaller icon bubble on mobile */}
            <span className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-2xl border border-blue-100 bg-blue-50 flex items-center justify-center">
              <Utensils className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#46769B]" />
            </span>

            <div className="min-w-0">
              {/* Title row: keep tight + wrap cleanly */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <p className="text-base sm:text-lg font-extrabold text-gray-900 leading-tight">
                  Nutrition
                </p>

                <TinyChip tone="blue">Suggested</TinyChip>

                {metaStatus ? <TinyChip tone="soft">{metaStatus}</TinyChip> : null}

                <TinyChip tone={tone}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {progressLabel}
                </TinyChip>
              </div>

              {/* make subtitle less “loud” on mobile */}
              {subtitle ? (
                <p className="text-[11px] sm:text-[12px] text-gray-600 mt-1.5 leading-snug line-clamp-2">
                  {subtitle}
                </p>
              ) : null}

              <div className="mt-1.5">{effLine}</div>

              {/* small feature: subtle progress bar */}
              <MiniBar pctValue={total ? pctRaw : 0} />
            </div>
          </div>

          {/* Right actions: keep compact */}
          <div className="shrink-0">
            <ActionButton onClick={onRefresh} title="Refresh nutrition data">
              <RefreshCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
              <span className="sm:hidden"> </span>
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
