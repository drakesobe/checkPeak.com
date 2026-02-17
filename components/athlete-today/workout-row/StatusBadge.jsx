"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldAlert,
  Camera,
  Info,
} from "lucide-react";
import { Pill } from "../ui";

/**
 * StatusBadge (athlete-facing)
 *
 * Goals:
 * - Clear, non-duplicative messaging (one chip, one meaning)
 * - Pending review feels “checked off” for the athlete (they can move on)
 * - Rejected is loud and actionable
 * - Evidence-required is clear, but not spammy
 * - Optional photo is calm and unobtrusive
 *
 * Props:
 * - isRejected: boolean
 * - isPending: boolean (pending_review)
 * - isCompleted: boolean (completed)
 * - evidenceRequired: boolean
 *
 * Optional props (if you want more control later):
 * - compact: boolean (smaller padding)
 * - showIcon: boolean
 * - labels: override chip text
 */
export default function StatusBadge({
  isRejected,
  isPending,
  isCompleted,
  evidenceRequired,

  // optional
  compact = false,
  showIcon = true,
  labels = {},
}) {
  // Single-source text with safe fallbacks
  const text = useMemo(() => {
    return {
      rejected: labels.rejected || "Rejected",
      pending: labels.pending || "Submitted",
      completed: labels.completed || "Done",
      proof: labels.proof || "Proof required",
      optional: labels.optional || "Optional photo",
      // micro-clarifiers (kept short)
      pendingHint: labels.pendingHint || "Coach review",
      rejectedHint: labels.rejectedHint || "Needs re-upload",
    };
  }, [labels]);

  // Priority order (most important state wins)
  // 1) rejected
  // 2) completed
  // 3) pending review
  // 4) proof required
  // 5) optional photo
  //
  // Note: You can swap completed/pending ordering if you prefer,
  // but rejected should always win.
  const state = useMemo(() => {
    if (isRejected) return "rejected";
    if (isCompleted) return "completed";
    if (isPending) return "pending";
    if (evidenceRequired) return "proof";
    return "optional";
  }, [isRejected, isCompleted, isPending, evidenceRequired]);

  // Tone mapping (your Pill tones are: neutral/good/warn/bad/attention)
  // We treat:
  // - rejected: warn (action needed)
  // - completed: good
  // - pending: good (athlete can move on)
  // - proof required: warn
  // - optional: neutral
  const tone =
    state === "completed" || state === "pending"
      ? "good"
      : state === "rejected" || state === "proof"
      ? "warn"
      : "neutral";

  // Icon selection by state (kept consistent and calm)
  const Icon = useMemo(() => {
    if (!showIcon) return null;

    if (state === "rejected") return XCircle;
    if (state === "completed") return CheckCircle2;
    if (state === "pending") return Clock;
    if (state === "proof") return AlertTriangle;
    return Camera; // optional photo
  }, [state, showIcon]);

  // Slight sizing control without changing your Pill component.
  // This only affects icon sizing + optional extra hint.
  const iconCls = compact ? "w-3 h-3" : "w-3.5 h-3.5";

  // Optional micro-hint content (kept very short to avoid layout clipping)
  // You can remove these entirely if you want “chip only”.
  const showHint = !compact && (state === "pending" || state === "rejected");

  return (
    <Pill tone={tone} className={compact ? "px-2 py-0.5" : ""}>
      {Icon ? <Icon className={`${iconCls} mr-1.5 shrink-0`} /> : null}

      {/* Primary label */}
      <span className="inline-flex items-center gap-1">
        {state === "rejected" ? text.rejected : null}
        {state === "completed" ? text.completed : null}
        {state === "pending" ? text.pending : null}
        {state === "proof" ? text.proof : null}
        {state === "optional" ? text.optional : null}
      </span>

      {/* Tiny secondary hint (only for the two “action/flow” states) */}
      {showHint ? (
        <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-semibold opacity-70">
          {state === "pending" ? (
            <>
              <ShieldAlert className="w-3 h-3" />
              {text.pendingHint}
            </>
          ) : state === "rejected" ? (
            <>
              <Info className="w-3 h-3" />
              {text.rejectedHint}
            </>
          ) : null}
        </span>
      ) : null}
    </Pill>
  );
}
