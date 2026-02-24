"use client";

import { useMemo } from "react";
import { Users, LayoutDashboard, RefreshCcw, CheckCircle2 } from "lucide-react";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

/* ---------------- small UI atoms ---------------- */

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

function ActionButton({ onClick, children, title = "", disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl",
        "px-2.5 py-2 text-xs font-semibold whitespace-nowrap",
        "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 transition",
        "focus:outline-none focus:ring-2 focus:ring-[#46769B]/25",
        disabled ? "opacity-60 cursor-not-allowed hover:bg-white" : ""
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

function progressTone(pctVal) {
  if (!pctVal) return "soft";
  if (pctVal >= 100) return "ok";
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
      aria-label="Roster completion progress"
    >
      <div className="h-full rounded-full bg-[#46769B] transition-all" style={{ width: `${p}%` }} />
    </div>
  );
}

/* ---------------- AthletesHeader ---------------- */

export default function AthletesHeader({
  onDashboard,
  onRefresh,
  refreshing,

  // optional data (nice-to-have)
  stats, // { total, ready, incomplete }
  batchProgress, // { total, done, pct }
  subtitle = "Coach-first roster with queue mode, bulk actions, and quick notes.",
  metaStatus, // optional string chip like "Live" / "Loading"
}) {
  const done = Number(batchProgress?.done || 0);
  const total = Number(batchProgress?.total || 0);
  const pctRaw = clampPct(batchProgress?.pct);
  const tone = useMemo(() => progressTone(pctRaw), [pctRaw]);

  const progressLabel = useMemo(() => {
    if (!total) return "No athletes";
    return `${done}/${total} (${pctRaw}%)`;
  }, [done, total, pctRaw]);

  const totalAth = Number(stats?.total || 0);
  const readyAth = Number(stats?.ready || 0);
  const incompleteAth = Number(stats?.incomplete || 0);

  return (
    <div className="rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-50" />

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          {/* Left */}
          <div className="min-w-0 flex items-start gap-3">
            <span className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-2xl border border-blue-100 bg-blue-50 flex items-center justify-center">
              <Users className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#46769B]" />
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <p className="text-base sm:text-lg font-extrabold text-gray-900 leading-tight">Athletes</p>

                <TinyChip tone="blue">Roster</TinyChip>

                {typeof metaStatus === "string" && metaStatus.trim() ? (
                  <TinyChip tone="soft">{metaStatus.trim()}</TinyChip>
                ) : null}

                <TinyChip tone={tone}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {progressLabel}
                </TinyChip>

                {totalAth > 0 ? (
                  <>
                    <TinyChip tone="soft">Total {totalAth}</TinyChip>
                    <TinyChip tone="ok">Ready {readyAth}</TinyChip>
                    {incompleteAth > 0 ? <TinyChip tone="warn">Missing {incompleteAth}</TinyChip> : null}
                  </>
                ) : null}
              </div>

              {subtitle ? (
                <p className="text-[11px] sm:text-[12px] text-gray-600 mt-1.5 leading-snug line-clamp-2">
                  {subtitle}
                </p>
              ) : null}

              <p className="text-[11px] text-gray-500 mt-1.5 leading-none">
                Tip: filter <span className="font-semibold text-gray-700">Ready</span>, sort{" "}
                <span className="font-semibold text-gray-700">Newest</span>, then use{" "}
                <span className="font-semibold text-gray-700">Next Up</span>.
              </p>

              <MiniBar pctValue={total ? pctRaw : 0} />
            </div>
          </div>

          {/* Right actions */}
          <div className="shrink-0 flex items-center gap-2">
            <ActionButton onClick={onDashboard} title="Back to dashboard">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </ActionButton>

            <ActionButton onClick={onRefresh} title="Refresh athletes" disabled={refreshing}>
              <RefreshCcw className={cx("w-4 h-4", refreshing ? "animate-spin" : "")} />
              <span className="hidden sm:inline">{refreshing ? "Refreshing" : "Refresh"}</span>
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}