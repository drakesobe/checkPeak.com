// components/athlete-today/complete-item-modal/components/ModalActions.jsx
"use client";

import { Camera, CheckCircle2 } from "lucide-react";
import { Button } from "../../ui";

export default function ModalActions({
  evidenceRequired,
  submitting,
  canSubmit,
  onClose,
  onSubmit,
}) {
  const submitLabel = evidenceRequired ? "Submit proof" : "Mark complete";

  return (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
      <Button variant="secondary" onClick={onClose} disabled={submitting}>
        Cancel
      </Button>

      {/* 
        Always tappable unless actively submitting - missing photo is handled upstream
        in handleAttemptSubmit which shows the error banner + shake instead of blocking
        the tap entirely. This gives the athlete feedback rather than a silent dead button.
      */}
      <Button onClick={onSubmit} disabled={submitting}>
        {evidenceRequired ? (
          <Camera className="w-4 h-4" />
        ) : (
          <CheckCircle2 className="w-4 h-4" />
        )}
        {submitting ? "Submitting…" : submitLabel}
      </Button>
    </div>
  );
}