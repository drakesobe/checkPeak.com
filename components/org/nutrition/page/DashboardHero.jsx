// components/org/nutrition/page/DashboardHero.jsx
"use client";

import { useMemo } from "react";
import { AlertTriangle, Clock, TrendingDown, Ban, Sparkles, ArrowRight } from "lucide-react";
import { cx } from "@/lib/org/nutrition/pageUtils";

/* ---------------- tiny helpers ---------------- */

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function pct(part, total) {
  const p = num(part);
  const t = num(total);
  if (p == null || t == null || t <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((p / t) * 100)));
}

function CountPill({ value, tone = "neutral", label }) {
  const v = value == null ? "—" : value;

  const cls =
    tone === "warn"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-800 border-red-200"
      : tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : "bg-gray-50 text-gray-700 border-gray-200";

  return (
    <span
      aria-label={label}
      className={cx("text-[11px] px-2 py-1 rounded-lg border font-semibold tabular-nums", cls)}
      title={label}
    >
      {v}
    </span>
  );
}

function TinyMeta({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
      <Icon className="w-3.5 h-3.5" />
      <span>{children}</span>
    </span>
  );
}

/* ---------------- QuickActionCard ---------------- */

function QuickActionCard({ title, body, tone = "neutral", onClick, right, icon: Icon }) {
  const toneCls =
    tone === "good"
      ? "border-emerald-200"
      : tone === "warn"
      ? "border-amber-200"
      : tone === "bad"
      ? "border-red-200"
      : "border-blue-100";

  const accent =
    tone === "good"
      ? "bg-emerald-500"
      : tone === "warn"
      ? "bg-amber-500"
      : tone === "bad"
      ? "bg-red-500"
      : "bg-[#46769B]";

  const iconBg =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-blue-50 text-[#46769B] border-blue-200";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "text-left w-full bg-white rounded-2xl shadow-md border p-4 relative overflow-hidden",
        "hover:shadow-lg hover:-translate-y-[1px] transition",
        "focus:outline-none focus:ring-2 focus:ring-[#46769B]/25",
        toneCls
      )}
    >
      <div className={cx("absolute left-0 top-0 h-1 w-full", accent)} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-3">
          {Icon ? (
            <span className={cx("shrink-0 w-9 h-9 rounded-2xl border flex items-center justify-center", iconBg)}>
              <Icon className="w-4.5 h-4.5" />
            </span>
          ) : null}

          <div className="min-w-0">
            <p className="text-sm font-extrabold text-gray-900">{title}</p>
            <p className="text-sm text-gray-600 mt-1">{body}</p>

            <div className="mt-2 text-[11px] font-semibold text-[#46769B] inline-flex items-center gap-1">
              View <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </button>
  );
}

/* ---------------- Hero ---------------- */

export default function DashboardHero({ headline, counts, onPickFilter }) {
  const total = useMemo(() => num(counts?.total) ?? 0, [counts?.total]);
  const needsAction = useMemo(() => num(counts?.needsAction), [counts?.needsAction]);
  const missing = useMemo(() => num(counts?.missingCheckin), [counts?.missingCheckin]);
  const low = useMemo(() => num(counts?.lowAdherence), [counts?.lowAdherence]);
  const noPlan = useMemo(() => num(counts?.noPlan), [counts?.noPlan]);

  const needsPct = useMemo(() => pct(needsAction, total), [needsAction, total]);
  const missPct = useMemo(() => pct(missing, total), [missing, total]);
  const lowPct = useMemo(() => pct(low, total), [low, total]);
  const noPlanPct = useMemo(() => pct(noPlan, total), [noPlan, total]);

  const coachLine = useMemo(() => {
    if (!total) return "Add athletes to start tracking plans and weekly check-ins.";
    const parts = [];
    if (noPlan) parts.push(`${noPlan} without a plan`);
    if (missing) parts.push(`${missing} missing check-ins`);
    if (low) parts.push(`${low} low adherence`);
    if (!parts.length) return "Everything looks healthy. Keep momentum and review check-ins weekly.";
    return `Today’s focus: ${parts.join(" • ")}.`;
  }, [total, noPlan, missing, low]);

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-gray-500">Nutrition Dashboard</p>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl border border-gray-200 bg-gray-50 text-[11px] text-gray-700 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Coach Overview
            </span>
          </div>

          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 truncate">{headline}</h1>

          <p className="mt-2 text-sm text-gray-600 max-w-2xl">{coachLine}</p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <TinyMeta icon={AlertTriangle}>
              Needs action: <span className="font-semibold text-gray-700">{needsAction ?? "—"}</span>
              {needsPct != null ? <span className="text-gray-500"> ({needsPct}%)</span> : null}
            </TinyMeta>

            <span className="text-gray-300">•</span>

            <TinyMeta icon={Clock}>
              Missing check-ins: <span className="font-semibold text-gray-700">{missing ?? "—"}</span>
              {missPct != null ? <span className="text-gray-500"> ({missPct}%)</span> : null}
            </TinyMeta>

            <span className="text-gray-300">•</span>

            <TinyMeta icon={TrendingDown}>
              Low adherence: <span className="font-semibold text-gray-700">{low ?? "—"}</span>
              {lowPct != null ? <span className="text-gray-500"> ({lowPct}%)</span> : null}
            </TinyMeta>

            <span className="text-gray-300">•</span>

            <TinyMeta icon={Ban}>
              No plan: <span className="font-semibold text-gray-700">{noPlan ?? "—"}</span>
              {noPlanPct != null ? <span className="text-gray-500"> ({noPlanPct}%)</span> : null}
            </TinyMeta>
          </div>
        </div>

        <div className="mt-1 grid gap-3 sm:grid-cols-4">
          <QuickActionCard
            title="Needs action"
            body="Plan/check-in follow-up."
            tone="neutral"
            icon={AlertTriangle}
            onClick={() => onPickFilter?.("action")}
            right={<CountPill value={needsAction} label="Needs action count" />}
          />

          <QuickActionCard
            title="Missing check-in"
            body="No submission this week."
            tone="warn"
            icon={Clock}
            onClick={() => onPickFilter?.("missing_checkin")}
            right={<CountPill value={missing} tone="warn" label="Missing check-in count" />}
          />

          <QuickActionCard
            title="Low adherence"
            body="Below your threshold."
            tone="warn"
            icon={TrendingDown}
            onClick={() => onPickFilter?.("low_adherence")}
            right={<CountPill value={low} tone="warn" label="Low adherence count" />}
          />

          <QuickActionCard
            title="No plan"
            body="No active targets yet."
            tone="bad"
            icon={Ban}
            onClick={() => onPickFilter?.("no_plan")}
            right={<CountPill value={noPlan} tone="bad" label="No plan count" />}
          />
        </div>
      </div>
    </section>
  );
}