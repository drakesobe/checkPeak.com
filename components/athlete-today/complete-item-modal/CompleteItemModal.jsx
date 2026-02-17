// components/athlete-today/complete-item-modal/CompleteItemModal.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "../ui";
import { normBool, safeText } from "./utils/text";
import ModalHeaderBanner from "./components/ModalHeaderBanner";
import PhotoSection from "./components/PhotoSection";
import NotesDropdown from "./components/NotesDropdown";
import ModalActions from "./components/ModalActions";

export default function CompleteItemModal({
  open,
  item,
  selectedFile,
  coachNote,
  submitting = false,
  onClose,
  onPickFile,
  onChangeNote,
  onSubmit,
}) {
  const [previewUrl, setPreviewUrl] = useState("");

  const evidenceRequired = useMemo(
    () => normBool(item?.EvidenceRequired),
    [item]
  );

  const title =
    safeText(item?.ExerciseName || item?.Title || "") || "Workout item";

  // Build / clean up preview URL
  useEffect(() => {
    if (!open) return;

    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }

    setPreviewUrl("");
  }, [open, selectedFile]);

  // When closing or switching items, clear preview
  useEffect(() => {
    if (!open) setPreviewUrl("");
  }, [open, item?.id]);

  if (!open) return null;

  const noteText = String(coachNote || "");
  const canSubmit =
    Boolean(item?.id) &&
    !submitting &&
    (!evidenceRequired || !!selectedFile);

  return (
    <Modal
      open={open}
      title={item ? `Complete: ${title}` : "Complete item"}
      onClose={onClose}
      subtitle={evidenceRequired ? "Take a photo to submit." : "Photo is optional."}
    >
      {!item ? null : (
        <div className="space-y-3 sm:space-y-4">
          <ModalHeaderBanner evidenceRequired={evidenceRequired} onClose={onClose} />

          <PhotoSection
            evidenceRequired={evidenceRequired}
            submitting={submitting}
            selectedFile={selectedFile}
            previewUrl={previewUrl}
            onPickFile={onPickFile}
          />

          <NotesDropdown value={noteText} onChange={onChangeNote} disabled={submitting} />

          <ModalActions
            evidenceRequired={evidenceRequired}
            submitting={submitting}
            canSubmit={canSubmit}
            onClose={onClose}
            onSubmit={onSubmit}
          />

          {evidenceRequired && !selectedFile ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[12px] text-amber-900 font-semibold">
                Photo required — take one before submitting.
              </p>
            </div>
          ) : null}

          <p className="text-[11px] text-gray-500 leading-snug">
            On mobile, <span className="font-semibold">Take photo</span> should open your
            camera. If it doesn’t, your browser may ask whether to use the camera or photo
            library.
          </p>
        </div>
      )}
    </Modal>
  );
}
