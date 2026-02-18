// hooks/org/useReviewQueue.js
"use client";

import { useCallback, useMemo, useState } from "react";

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeText(v) {
  return String(v ?? "").trim();
}

function toLower(v) {
  return String(v || "").trim().toLowerCase();
}

function asBool(v) {
  // Airtable checkbox can come through as true/false already
  if (typeof v === "boolean") return v;

  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return false;
  return s === "true" || s === "1" || s === "yes" || s === "y";
}

// Map WorkoutCompletions.Status -> UI reviewStatus buckets
function reviewBucketFromCompletionStatus(status) {
  const st = toLower(status);
  if (st === "completed") return "approved";
  if (st === "rejected") return "needs_info";
  // default covers pending_review and anything else
  return "pending";
}

export function normalizeQueueItem(raw = {}) {
  const id = normalizeText(raw?.id || raw?.recordId || raw?._id);

  // Title should usually come from WorkoutItem/ExerciseName if your API provides it
  const title =
    normalizeText(raw?.title || raw?.Title || raw?.ExerciseName || raw?.name || raw?.Name) ||
    "Workout Completion";

  const date = normalizeText(raw?.date || raw?.Date || raw?.CompletedAt) || "";

  // From WorkoutCompletions
  const status = normalizeText(raw?.status || raw?.Status); // pending_review / rejected / completed
  const reviewStatus =
    normalizeText(raw?.reviewStatus || raw?.ReviewStatus) || reviewBucketFromCompletionStatus(status);

  const attachmentSummary = normalizeText(
    raw?.attachmentSummary || raw?.AttachmentSummary || raw?.["Attachment Summary"]
  );

  // WorkoutCompletions field name is "Attachment" (per you)
  const attachments = Array.isArray(raw?.attachments)
    ? raw.attachments
    : Array.isArray(raw?.Attachment)
    ? raw.Attachment
    : Array.isArray(raw?.Attachments)
    ? raw.Attachments
    : [];

  const athleteName = normalizeText(raw?.athleteName || raw?.AthleteName || raw?.Athlete);
  const athleteEmail = normalizeText(raw?.athleteEmail || raw?.AthleteEmail || raw?.Email);

  const createdAt = raw?.createdAt || raw?.CreatedAt || raw?.createdTime || raw?.CreatedTime || "";

  // Your field is ReviewNote
  const coachNotes = normalizeText(
    raw?.ReviewNote || raw?.reviewNote || raw?.coachNotes || raw?.notes || ""
  );

  // ✅ NEW: athlete acknowledgement (checkbox + timestamp)
  const athleteAcknowledged = asBool(
    raw?.athleteAcknowledged ??
      raw?.AthleteAcknowledged ??
      raw?.["AthleteAcknowledged"] ??
      false
  );

  const athleteAcknowledgedAt = normalizeText(
    raw?.athleteAcknowledgedAt ??
      raw?.AthleteAcknowledgedAt ??
      raw?.["AthleteAcknowledgedAt"] ??
      ""
  );

  return {
    id,
    title,
    date,
    status, // completion status
    reviewStatus, // UI bucket
    attachmentSummary,
    attachments,
    athleteName,
    athleteEmail,
    createdAt,
    coachNotes,

    athleteAcknowledged,
    athleteAcknowledgedAt,

    _raw: raw,
  };
}

export function useReviewQueue() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  const refreshQueue = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/org/reviewQueue/getReviewQueue", {
        method: "GET",
        credentials: "include",
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load review queue");

      const rawItems = Array.isArray(data?.items) ? data.items : [];
      setItems(rawItems.map(normalizeQueueItem));
    } catch (e) {
      setError(e?.message || "Failed to load review queue.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const counts = useMemo(() => {
    const list = Array.isArray(items) ? items : [];

    const pending = list.filter((x) => toLower(x?.reviewStatus) === "pending").length;
    const needsInfo = list.filter((x) => toLower(x?.reviewStatus) === "needs_info").length;
    const approved = list.filter((x) => toLower(x?.reviewStatus) === "approved").length;

    // ✅ NEW: acknowledgement count (useful for “rejected / needs_info” cases)
    const acknowledged = list.filter((x) => Boolean(x?.athleteAcknowledged)).length;

    return { pending, needsInfo, approved, acknowledged, total: list.length };
  }, [items]);

  const fmtDate = useCallback((value) => {
    const d = safeDate(value);
    if (!d) return value ? String(value) : "";
    return d.toLocaleString();
  }, []);

  return {
    loading,
    error,
    items,
    setItems,
    refreshQueue,
    counts,
    fmtDate,
  };
}
