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

export function normalizeQueueItem(raw = {}) {
  const id = normalizeText(raw?.id || raw?.recordId || raw?._id);

  const title =
    normalizeText(raw?.title || raw?.Title || raw?.name || raw?.Name) || "Daily Workout";

  const date = normalizeText(raw?.date || raw?.Date);
  const status = normalizeText(raw?.status || raw?.Status);
  const reviewStatus =
    normalizeText(raw?.reviewStatus || raw?.ReviewStatus || raw?.review_state) || "pending";

  const attachmentSummary = normalizeText(
    raw?.attachmentSummary || raw?.["Attachment Summary"] || raw?.AttachmentSummary
  );

  const attachments = Array.isArray(raw?.attachments)
    ? raw.attachments
    : Array.isArray(raw?.Attachments)
    ? raw.Attachments
    : [];

  const athleteName = normalizeText(raw?.athleteName || raw?.AthleteName || raw?.Athlete);
  const athleteEmail = normalizeText(raw?.athleteEmail || raw?.AthleteEmail || raw?.Email);

  const createdAt = raw?.createdAt || raw?.CreatedAt || raw?.createdTime || raw?.CreatedTime || "";
  const coachNotes = normalizeText(raw?.coachNotes || raw?.CoachNotes || raw?.notes || raw?.Notes);

  return {
    id,
    title,
    date,
    status,
    reviewStatus,
    attachmentSummary,
    attachments,
    athleteName,
    athleteEmail,
    createdAt,
    coachNotes,
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
    const pending = list.filter((x) => String(x?.reviewStatus || "").toLowerCase() === "pending")
      .length;
    const needsInfo = list.filter(
      (x) => String(x?.reviewStatus || "").toLowerCase() === "needs_info"
    ).length;
    const approved = list.filter(
      (x) => String(x?.reviewStatus || "").toLowerCase() === "approved"
    ).length;
    return { pending, needsInfo, approved, total: list.length };
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
