// components/athlete-today/StatusBadge.jsx (or wherever it lives)
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

export default function StatusBadge({
  isRejected,
  isPending,
  isCompleted,
  evidenceRequired,
  compact = false,
  showIcon = true,
  labels = {},
}) {
  const text = useMemo(() => ({
    rejected:     labels.rejected     || "Rejected",
    pending:      labels.pending      || "Submitted",
    completed:    labels.completed    || "Done",
    proof:        labels.proof        || "Proof required",
    // "optional photo" replaced — no badge shown at all (see state logic below)
    pendingHint:  labels.pendingHint  || "Coach review",
    rejectedHint: labels.rejectedHint || "Needs re-upload",
  }), [labels]);

  // Priority: rejected > completed > pending > proof required
  // When evidenceRequired=false and no completion state, return null — no badge needed.
  const state = useMemo(() => {
    if (isRejected)      return "rejected";
    if (isCompleted)     return "completed";
    if (isPending)       return "pending";
    if (evidenceRequired) return "proof";
    return "none"; // no badge for plain unstarted optional items
  }, [isRejected, isCompleted, isPending, evidenceRequired]);

  if (state === "none") return null;

  const tone =
    state === "completed" || state === "pending" ? "good" :
    state === "rejected"  || state === "proof"   ? "warn" :
    "neutral";

  const Icon = useMemo(() => {
    if (!showIcon) return null;
    if (state === "rejected")  return XCircle;
    if (state === "completed") return CheckCircle2;
    if (state === "pending")   return Clock;
    if (state === "proof")     return AlertTriangle;
    return null;
  }, [state, showIcon]);

  const iconCls = compact ? "w-3 h-3" : "w-3.5 h-3.5";
  const showHint = !compact && (state === "pending" || state === "rejected");

  return (
    <Pill tone={tone} className={compact ? "px-2 py-0.5" : ""}>
      {Icon ? <Icon className={`${iconCls} mr-1.5 shrink-0`} /> : null}

      <span className="inline-flex items-center gap-1">
        {state === "rejected"  ? text.rejected  : null}
        {state === "completed" ? text.completed : null}
        {state === "pending"   ? text.pending   : null}
        {state === "proof"     ? text.proof     : null}
      </span>

      {showHint ? (
        <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-semibold opacity-70">
          {state === "pending" ? (
            <><ShieldAlert className="w-3 h-3" />{text.pendingHint}</>
          ) : state === "rejected" ? (
            <><Info className="w-3 h-3" />{text.rejectedHint}</>
          ) : null}
        </span>
      ) : null}
    </Pill>
  );
}