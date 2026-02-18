// hooks/athlete-today/useWorkoutCompletion.js
"use client";

import { useCallback, useState } from "react";
import { safeJson } from "@/components/athlete-today/ui";

/**
 * Handles:
 * - modal state
 * - file selection + note
 * - submit -> /api/athlete/workouts/completeItem (multipart FormData)
 * - quickComplete (same endpoint, no file)
 *
 * Adds:
 * - optimisticStatusById: instant UI feedback on success (pending_review/completed)
 * - acknowledgeCompletion: athlete confirms they saw coach note on rejected item
 */
export function useWorkoutCompletion({ selectedDate, reload, setErr }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(null);

  const [submittingId, setSubmittingId] = useState("");
  const [acknowledgingId, setAcknowledgingId] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [coachNote, setCoachNote] = useState("");

  // ✅ optimistic UI: { [workoutItemId]: "pending_review" | "completed" | "rejected" | "assigned" | "acknowledged" }
  const [optimisticStatusById, setOptimisticStatusById] = useState({});

  const openModal = useCallback(
    (item) => {
      setErr?.("");
      setSelectedFile(null);
      setCoachNote("");
      setActiveItem(item);
      setModalOpen(true);
    },
    [setErr]
  );

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setActiveItem(null);
    setSelectedFile(null);
    setCoachNote("");
    setSubmittingId("");
  }, []);

  const postCompletion = useCallback(
    async ({ workoutItemId, evidenceRequired, dailyWorkoutId, file, note }) => {
      const fd = new FormData();
      fd.append("workoutItemId", String(workoutItemId || "").trim());
      fd.append("evidenceRequired", String(Boolean(evidenceRequired)));
      fd.append("dailyWorkoutId", String(dailyWorkoutId || "").trim());
      fd.append("note", String(note || ""));

      if (file) fd.append("file", file);

      const res = await fetch("/api/athlete/workouts/completeItem", {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to submit");
      return data;
    },
    []
  );

  const submitCompletion = useCallback(
    async ({ workoutItemId, evidenceRequired, dailyWorkoutId }) => {
      const id = String(workoutItemId || "").trim();
      if (!id) {
        setErr?.("Missing workout item id.");
        return;
      }

      setErr?.("");
      setSubmittingId(id);

      try {
        const usedFile = selectedFile;

        // strict gating: if proof required, must have file
        if (String(evidenceRequired).toLowerCase() === "true" && !usedFile) {
          throw new Error("This item requires a photo. Please take/upload a photo first.");
        }

        const data = await postCompletion({
          workoutItemId: id,
          evidenceRequired: String(evidenceRequired).toLowerCase() === "true",
          dailyWorkoutId: String(dailyWorkoutId || "").trim(),
          file: usedFile || null,
          note: coachNote || "",
        });

        // ✅ INSTANT FEEDBACK
        const nextStatus = String(data?.status || "").trim().toLowerCase();
        if (nextStatus) {
          setOptimisticStatusById((prev) => ({ ...prev, [id]: nextStatus }));
        }

        // keep the "instant" state around briefly even if reload is slow
        const keepMs = 2500;
        setTimeout(() => {
          setOptimisticStatusById((prev) => {
            if (!prev?.[id]) return prev;
            const { [id]: _, ...rest } = prev;
            return rest;
          });
        }, keepMs);

        await reload(selectedDate);
        closeModal();
      } catch (e) {
        setErr?.(e?.message || "Failed to submit");
      } finally {
        setSubmittingId("");
      }
    },
    [selectedFile, coachNote, postCompletion, reload, selectedDate, closeModal, setErr]
  );

  const quickComplete = useCallback(
    async (workoutItemId, dailyWorkoutId = "") => {
      const id = String(workoutItemId || "").trim();
      if (!id) return;

      setErr?.("");
      setSubmittingId(id);

      try {
        const data = await postCompletion({
          workoutItemId: id,
          evidenceRequired: false,
          dailyWorkoutId: String(dailyWorkoutId || "").trim(),
          file: null,
          note: "",
        });

        const nextStatus = String(data?.status || "").trim().toLowerCase();
        if (nextStatus) {
          setOptimisticStatusById((prev) => ({ ...prev, [id]: nextStatus }));
        }

        setTimeout(() => {
          setOptimisticStatusById((prev) => {
            if (!prev?.[id]) return prev;
            const { [id]: _, ...rest } = prev;
            return rest;
          });
        }, 2000);

        await reload(selectedDate);
      } catch (e) {
        setErr?.(e?.message || "Failed to submit");
      } finally {
        setSubmittingId("");
      }
    },
    [postCompletion, reload, selectedDate, setErr]
  );

  /**
   * ✅ Athlete acknowledges a rejected completion.
   * Expected API: POST /api/athlete/workouts/acknowledgeCompletion
   * Accepts either:
   *  - { completionId }
   *  - OR { workoutItemId, date } (server can resolve latest completion)
   */
  const acknowledgeCompletion = useCallback(
    async ({ completionId, workoutItemId }) => {
      const wid = String(workoutItemId || "").trim();
      const cid = String(completionId || "").trim();

      if (!cid && !wid) {
        setErr?.("Missing completion id.");
        return;
      }

      setErr?.("");
      setAcknowledgingId(wid || cid);

      try {
        // optimistic: mark as acknowledged (your UI can treat this as checked-off)
        if (wid) {
          setOptimisticStatusById((prev) => ({ ...prev, [wid]: "acknowledged" }));
        }

        const res = await fetch("/api/athlete/workouts/acknowledgeCompletion", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            completionId: cid || undefined,
            workoutItemId: wid || undefined,
            date: String(selectedDate || "").trim() || undefined,
          }),
        });

        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || "Failed to acknowledge");

        // Let Airtable truth win
        await reload(selectedDate);
      } catch (e) {
        // rollback optimistic if it was set
        if (wid) {
          setOptimisticStatusById((prev) => {
            const { [wid]: _, ...rest } = prev || {};
            return rest;
          });
        }
        setErr?.(e?.message || "Failed to acknowledge");
      } finally {
        setAcknowledgingId("");
      }
    },
    [reload, selectedDate, setErr]
  );

  return {
    modalOpen,
    activeItem,
    selectedFile,
    coachNote,
    submittingId,
    acknowledgingId,
    optimisticStatusById,

    openModal,
    closeModal,

    setSelectedFile,
    setCoachNote,

    submitCompletion,
    quickComplete,
    acknowledgeCompletion, // ✅ NEW
  };
}
