// components/athlete-today/workout/WorkoutCard.jsx
"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Dumbbell,
  ShieldAlert,
} from "lucide-react";
import { statusTone } from "./ui";
import WorkoutItemRow from "./WorkoutItemRow";

/* ── helpers ── */
function cx(...xs) { return xs.filter(Boolean).join(" "); }
function norm(v)    { return String(v ?? "").trim().toLowerCase(); }
function safeText(v){ return String(v ?? "").trim(); }

function pickNote(dw) {
  const v = dw?.ReviewedNotes ?? dw?.reviewedNotes ?? "";
  if (Array.isArray(v)) return String(v?.[0] ?? "").trim();
  return String(v ?? "").trim();
}

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function isDoneItem(it, optimisticStatus = "") {
  const st = norm(optimisticStatus || it?.Status || "");
  const completed = norm(it?.Completed || it?.completed || "") === "true";
  if (completed)             return true;
  if (st === "completed")    return true;
  if (st === "pending_review") return true;
  if (st === "acknowledged") return true;
  return false;
}

/* ── Sub-components ── */

function StatusChip({ tone = "neutral", children }) {
  const cls =
    tone === "ok"     ? "bg-emerald-50 text-emerald-900 border-emerald-200" :
    tone === "blue"   ? "bg-blue-50 text-blue-900 border-blue-200" :
    tone === "warn"   ? "bg-amber-50 text-amber-900 border-amber-200" :
                        "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span className={cx(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
      "text-[11px] font-semibold leading-none whitespace-nowrap",
      cls
    )}>
      {children}
    </span>
  );
}

function MiniBar({ pct, allDone }) {
  const p = clampPct(pct);
  return (
    <div
      className="h-2 w-full rounded-full bg-gray-100 border border-gray-100 overflow-hidden"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={p}
      aria-label="Workout completion"
    >
      <div
        className={cx(
          "h-full rounded-full transition-all duration-500",
          allDone ? "bg-emerald-400" : "bg-[#46769B]"
        )}
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

/* ── Component ── */

export default function WorkoutCard({
  loading = false,
  dailyWorkout,
  items = [],
  onUpload,
  onQuickComplete,
  submittingId = "",
  onAcknowledge,
  acknowledgingId = "",
  optimisticStatusById = {},
}) {
  const list       = Array.isArray(items) ? items : [];
  const hasWorkout = Boolean(dailyWorkout);
  const hasItems   = list.length > 0;

  const workoutStatus    = norm(safeText(dailyWorkout?.Status || "assigned"));
  const workoutStatusRaw = safeText(dailyWorkout?.Status || "Assigned");
  const reviewStatus     = norm(dailyWorkout?.ReviewStatus || dailyWorkout?.reviewStatus || "");
  const reviewedNotes    = pickNote(dailyWorkout);

  const needsInfo        = reviewStatus === "needs_info";
  const isWorkoutDone    = workoutStatus === "completed";

  const progress = useMemo(() => {
    const total = list.length;
    const done  = list.filter((x) => {
      const id        = String(x?.id || x?.ID || x?.recordId || "").trim();
      const optimistic = optimisticStatusById?.[id] || "";
      return isDoneItem(x, optimistic);
    }).length;
    const pct   = total ? Math.round((done / total) * 100) : 0;
    return { total, done, pct, allDone: total > 0 && done >= total };
  }, [list, optimisticStatusById]);

  // ── Empty: no workout ──
  if (!loading && !hasWorkout) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white overflow-hidden">
        <div className="p-6 flex items-start gap-3">
          <span className="h-10 w-10 rounded-2xl border border-amber-100 bg-amber-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-gray-800">No workout assigned</p>
            <p className="text-[12px] text-gray-500 mt-1 leading-snug">
              Nothing scheduled for this day yet — check back or contact your coach.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Derive status chip tone ──
  const rawTone = statusTone(dailyWorkout?.Status);
  const chipTone =
    rawTone === "good" ? "ok" :
    rawTone === "warn" ? "warn" :
    rawTone === "blue" ? "blue" : "neutral";

  return (
    <div className="rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
      {/* Top accent — animates to emerald when all done */}
      <div className={cx(
        "h-1 w-full transition-colors duration-700",
        progress.allDone ? "bg-emerald-400" : "bg-[#46769B]"
      )} />

      <div className="p-5">

        {/* ── Header ── */}
        <div className="flex items-start gap-4">
          <span className={cx(
            "shrink-0 h-11 w-11 rounded-2xl border flex items-center justify-center transition-colors duration-500",
            progress.allDone
              ? "border-emerald-200 bg-emerald-50"
              : "border-blue-100 bg-blue-50"
          )}>
            {progress.allDone
              ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              : <Dumbbell className="w-5 h-5 text-[#46769B]" />
            }
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-extrabold text-gray-900 leading-tight">Workout</p>

              {workoutStatus !== "assigned" ? (
                <StatusChip tone={chipTone}>
                  {workoutStatusRaw}
                </StatusChip>
              ) : null}

              {needsInfo ? (
                <StatusChip tone="warn">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Needs info
                </StatusChip>
              ) : null}
            </div>

            {safeText(dailyWorkout?.Title) ? (
              <p className="text-xs text-gray-500 mt-1 leading-snug truncate">
                {safeText(dailyWorkout?.Title)}
              </p>
            ) : null}

            {progress.total > 0 ? (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                    {progress.allDone ? "All done" : "Progress"}
                  </span>
                  <span className={cx(
                    "text-xs font-black tabular-nums",
                    progress.allDone ? "text-emerald-600" : "text-gray-600"
                  )}>
                    {progress.done}/{progress.total}
                  </span>
                </div>
                <MiniBar pct={progress.pct} allDone={progress.allDone} />
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Needs-info coach message ── */}
        {needsInfo && reviewedNotes ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <span className="h-10 w-10 rounded-2xl border border-amber-200 bg-white flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-700" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-gray-900">Coach message</p>
                <p className="text-[12px] text-gray-700 mt-2 whitespace-pre-wrap break-words leading-snug">
                  {reviewedNotes}
                </p>
                <p className="text-[11px] text-gray-500 mt-2">
                  Re-submit with the requested details.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Items ── */}
        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 space-y-2">
              {/* Skeleton shimmer */}
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-blue-100/60 animate-pulse" />
              ))}
            </div>
          ) : hasItems ? (
            list.map((it, idx) => {
              const id           = String(it?.id || it?.ID || it?.recordId || "").trim();
              const completionId = safeText(it?.CompletionId || it?.completionId || "");
              const submitting   = Boolean(submittingId && id && submittingId === id);
              const acknowledging = Boolean(
                acknowledgingId &&
                (acknowledgingId === id || (completionId && acknowledgingId === completionId))
              );
              const key = id || `${idx}-${safeText(it?.Title || it?.Name || "item")}`;

              return (
                <WorkoutItemRow
                  key={key}
                  item={it}
                  submitting={submitting}
                  acknowledging={acknowledging}
                  optimisticStatus={optimisticStatusById?.[id] || ""}
                  onUpload={onUpload}
                  onQuickComplete={onQuickComplete}
                  onAcknowledge={onAcknowledge}
                />
              );
            })
          ) : (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
              <p className="text-sm font-black text-gray-800">Workout assigned — no items found</p>
              <p className="text-[12px] text-gray-600 mt-1 leading-snug">
                Your coach assigned a workout but hasn't linked the items yet. Refresh or ask them to check the record.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}