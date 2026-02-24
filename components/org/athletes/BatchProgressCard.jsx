"use client";

import { useMemo } from "react";
import { CheckCircle2, ListChecks } from "lucide-react";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toneForPct(p) {
  if (p >= 100) return "ok";
  if (p >= 50) return "blue";
  return "soft";
}

function TinyChip({ children, tone = "soft", className = "" }) {
  const toneCls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : tone === "blue"
      ? "bg-blue-50 text-blue-900 border-blue-200"
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

export default function BatchProgressCard({ cardClass = "", batchProgress }) {
  const done = Number(batchProgress?.done || 0);
  const total = Number(batchProgress?.total || 0);
  const pct = useMemo(() => clampPct(batchProgress?.pct), [batchProgress?.pct]);
  const tone = useMemo(() => toneForPct(pct), [pct]);

  const label = useMemo(() => {
    if (!total) return "No athletes in this view";
    if (pct >= 100) return "All done";
    if (pct >= 50) return "Good pace";
    return "Getting started";
  }, [total, pct]);

  const chipTone = tone === "ok" ? "ok" : tone === "blue" ? "blue" : "soft";

  const barBg =
    tone === "ok"
      ? "bg-emerald-100"
      : tone === "blue"
      ? "bg-blue-100"
      : "bg-gray-100";

  const barFill =
    tone === "ok"
      ? "bg-emerald-600"
      : tone === "blue"
      ? "bg-[#46769B]"
      : "bg-[#46769B]";

  return (
    <div className={cx(cardClass, "rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden")}>
      {/* top gradient accent */}
      <div className="h-1 w-full bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-50" />

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          {/* Left */}
          <div className="min-w-0 flex items-start gap-3">
            <span className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-2xl border border-blue-100 bg-blue-50 flex items-center justify-center">
              <ListChecks className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#46769B]" />
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <p className="text-base sm:text-lg font-extrabold text-gray-900 leading-tight">
                  Batch Progress
                </p>

                <TinyChip tone={chipTone}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {total ? `${done}/${total}` : "0/0"}
                </TinyChip>

                <TinyChip tone={chipTone}>{pct}%</TinyChip>

                <TinyChip tone="soft">{label}</TinyChip>
              </div>

              <p className="text-[11px] sm:text-[12px] text-gray-600 mt-1.5 leading-snug">
                Progress is calculated on the <span className="font-semibold text-gray-700">current filtered</span>{" "}
                list.
              </p>

              {/* progress bar */}
              <div
                className={cx(
                  "mt-2.5 h-2.5 w-full rounded-full border border-gray-200 overflow-hidden",
                  barBg
                )}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label="Batch progress"
              >
                <div className={cx("h-full rounded-full transition-all", barFill)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          {/* Right number (desktop-ish) */}
          <div className="shrink-0 text-right hidden sm:block">
            <p className="text-xs text-gray-500">Completion</p>
            <p className="text-lg font-extrabold text-gray-900 mt-1">{pct}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}