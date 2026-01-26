// hooks/athlete-today/useWorkoutCompletion.js
"use client";

import { useCallback, useState } from "react";
import { safeJson } from "@/components/athlete-today/ui";

/**
 * Handles:
 * - modal state
 * - file selection + note
 * - upload -> completeItem
 * - quickComplete
 *
 * Expects endpoint:
 *   POST /api/upload/image -> { url }
 *   POST /api/athlete/workouts/completeItem
 */
export function useWorkoutCompletion({ selectedDate, reload, setErr }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(null);

  const [submittingId, setSubmittingId] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [coachNote, setCoachNote] = useState("");

  const openModal = useCallback((item) => {
    setErr?.("");
    setSelectedFile(null);
    setCoachNote("");
    setActiveItem(item);
    setModalOpen(true);
  }, [setErr]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setActiveItem(null);
    setSelectedFile(null);
    setCoachNote("");
    setSubmittingId("");
  }, []);

  const uploadImage = useCallback(async (file) => {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/upload/image", {
      method: "POST",
      body: fd,
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || "Image upload failed");

    const url = String(data?.url || "").trim();
    if (!url) throw new Error("Upload failed: missing URL");
    return url;
  }, []);

  const submitCompletion = useCallback(
    async ({ workoutItemId, evidenceRequired }) => {
      setErr?.("");
      setSubmittingId(workoutItemId);

      try {
        const usedFile = selectedFile;

        // MVP: allow URL prompt if no file selected
        if (!usedFile) {
          const wantsMvpUrl = !evidenceRequired;
          const fileUrl = wantsMvpUrl
            ? window.prompt("Optional: paste a photo URL (MVP). Leave blank to mark complete without proof.")
            : window.prompt("Proof required: paste a photo URL (MVP) OR cancel and upload a file.");

          if (fileUrl && String(fileUrl).trim()) {
            const res = await fetch("/api/athlete/workouts/completeItem", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                workoutItemId,
                fileUrl: String(fileUrl).trim(),
                note: coachNote || "",
              }),
            });

            const data = await safeJson(res);
            if (!res.ok) throw new Error(data?.error || "Failed to submit");
            await reload(selectedDate);
            closeModal();
            return;
          }

          if (evidenceRequired) {
            throw new Error("This item requires a photo. Please upload an image (or provide a URL).");
          }

          const res = await fetch("/api/athlete/workouts/completeItem", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ workoutItemId, fileUrl: "", note: coachNote || "" }),
          });

          const data = await safeJson(res);
          if (!res.ok) throw new Error(data?.error || "Failed to submit");
          await reload(selectedDate);
          closeModal();
          return;
        }

        // Correct: upload -> URL -> complete
        const uploadedUrl = await uploadImage(usedFile);

        const res = await fetch("/api/athlete/workouts/completeItem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            workoutItemId,
            fileUrl: uploadedUrl,
            note: coachNote || "",
          }),
        });

        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || "Failed to submit");

        await reload(selectedDate);
        closeModal();
      } catch (e) {
        setErr?.(e?.message || "Failed to submit");
      } finally {
        setSubmittingId("");
      }
    },
    [selectedFile, coachNote, uploadImage, reload, selectedDate, closeModal, setErr],
  );

  const quickComplete = useCallback(
    async (workoutItemId) => {
      setErr?.("");
      setSubmittingId(workoutItemId);
      try {
        const res = await fetch("/api/athlete/workouts/completeItem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ workoutItemId, fileUrl: "", note: "" }),
        });

        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || "Failed to submit");
        await reload(selectedDate);
      } catch (e) {
        setErr?.(e?.message || "Failed to submit");
      } finally {
        setSubmittingId("");
      }
    },
    [reload, selectedDate, setErr],
  );

  return {
    modalOpen,
    activeItem,
    selectedFile,
    coachNote,
    submittingId,

    openModal,
    closeModal,

    setSelectedFile,
    setCoachNote,

    submitCompletion,
    quickComplete,
  };
}
