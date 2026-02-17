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

      <Button onClick={onSubmit} disabled={!canSubmit}>
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
