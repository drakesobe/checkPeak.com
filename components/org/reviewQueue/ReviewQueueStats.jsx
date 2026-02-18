// components/org/reviewQueue/ReviewQueueStats.jsx
"use client";

/**
 * ReviewQueueStats
 * Goals:
 * - Support the "workbench" (table) without competing with it
 * - Mobile-first: clean 2-up grid, then 3-up on larger screens
 * - Clear hierarchy: label → value → (optional) micro-hint
 * - Small, helpful UX: quick “what should I do next” guidance + optional click-to-filter support
 *
 * Notes:
 * - This component is designed to be wrapped by the page in a single card (optional),
 *   but it also works standalone.
 * - If you want the stat cards to change the page filter when clicked, pass `onSetFilter`
 *   and (optionally) `activeFilter`.
 */

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Clock, Info } from "lucide-react";

function safeNum(v) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "base", // base | pending | warn | ok
  clickable = false,
  active = false,
  onClick,
}) {
  const toneCls =
    tone === "pending"
      ? "border-sky-200 bg-sky-50/60"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50/60"
      : tone === "ok"
      ? "border-emerald-200 bg-emerald-50/60"
      : "border-blue-100 bg-white";

  const hoverCls = clickable ? "hover:shadow-lg hover:border-blue-200 active:scale-[0.99]" : "";
  const activeRing = active ? "ring-2 ring-[#46769B]/30" : "";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={cx(
        "text-left w-full rounded-2xl border shadow-md transition",
        "p-4 sm:p-5",
        toneCls,
        hoverCls,
        activeRing,
        clickable ? "cursor-pointer" : "cursor-default"
      )}
      aria-pressed={clickable ? Boolean(active) : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-600 tracking-wide">{label}</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1 leading-none">{value}</p>
          {hint ? <p className="text-[11px] text-gray-600 mt-2 leading-snug">{hint}</p> : null}
        </div>

        {Icon ? (
          <div className="shrink-0 w-10 h-10 rounded-2xl bg-white/70 border border-white/60 flex items-center justify-center">
            <Icon className="w-5 h-5 text-gray-700" />
          </div>
        ) : null}
      </div>
    </button>
  );
}

function NextActionHint({ pending, needsInfo, approved }) {
  // Keep this subtle: it’s “coach guidance”, not a banner.
  const text = useMemo(() => {
    if (pending > 0) return `Start with Pending — ${pending} item(s) need review.`;
    if (needsInfo > 0) return `Follow up on Needs Info — ${needsInfo} item(s) are waiting on athletes.`;
    if (approved > 0) return `Queue is clear. ${approved} approved so far.`;
    return "Queue is empty right now. When athletes submit uploads, they’ll appear here.";
  }, [pending, needsInfo, approved]);

  return (
    <div className="mt-3 flex items-start gap-2 text-xs text-gray-600">
      <Info className="w-4 h-4 mt-[1px] text-gray-400 shrink-0" />
      <p className="leading-relaxed">{text}</p>
    </div>
  );
}

export default function ReviewQueueStats({
  counts,
  // Optional enhancements:
  onSetFilter, // (filter: "pending" | "needs_info" | "approved" | "all") => void
  activeFilter, // string
}) {
  const pending = safeNum(counts?.pending);
  const needsInfo = safeNum(counts?.needsInfo);
  const approved = safeNum(counts?.approved);

  const clickable = typeof onSetFilter === "function";

  return (
    <div>
      {/* Mobile: 2-up grid; Desktop: 3-up grid.
          This keeps stats readable without becoming a “dashboard block.” */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Pending"
          value={pending}
          hint={pending > 0 ? "These need your review now." : "No items waiting for review."}
          icon={Clock}
          tone={pending > 0 ? "pending" : "base"}
          clickable={clickable}
          active={String(activeFilter || "") === "pending"}
          onClick={clickable ? () => onSetFilter("pending") : undefined}
        />

        <StatCard
          label="Needs Info"
          value={needsInfo}
          hint={needsInfo > 0 ? "Waiting on athletes to re-submit." : "No items waiting on athletes."}
          icon={AlertTriangle}
          tone={needsInfo > 0 ? "warn" : "base"}
          clickable={clickable}
          active={String(activeFilter || "") === "needs_info"}
          onClick={clickable ? () => onSetFilter("needs_info") : undefined}
        />

        {/* On small screens, this becomes the 3rd tile in the 2-col grid (wraps nicely).
            On large screens, it aligns as the third column. */}
        <StatCard
          label="Approved"
          value={approved}
          hint={approved > 0 ? "Done and cleared from review." : "No approvals yet today."}
          icon={CheckCircle2}
          tone={approved > 0 ? "ok" : "base"}
          clickable={clickable}
          active={String(activeFilter || "") === "approved"}
          onClick={clickable ? () => onSetFilter("approved") : undefined}
        />
      </div>

      <NextActionHint pending={pending} needsInfo={needsInfo} approved={approved} />
    </div>
  );
}
