"use client";

import toast from "react-hot-toast";
import { cleanString, normalizeEmail, safeCsvCell, downloadTextFile, formatDateTime } from "@/lib/org/athletes/utils";

export function useAthletesRosterActions({
  router,
  coachState,
  setCoachState,
  selectedIds,
  setSelectedIds,
  paged,
  filtered,
  selectedList,
  selectedEmails,
  openDrawer,
  goNextAfter,
  setAthletesRaw,   // ← needed for optimistic sport update
}) {
  const copyText = async (text, okMsg = "Copied") => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      toast.success(okMsg);
    } catch {
      window.prompt("Copy:", String(text || ""));
    }
  };

  const openPrescriptions = (email) => {
    const em = normalizeEmail(email);
    if (!em) return toast.error("This athlete is missing an email.");
    router.push(`/org/prescriptions?athleteEmail=${encodeURIComponent(em)}`);
  };

  const openPrescriptionsNewTab = (email) => {
    const em = normalizeEmail(email);
    if (!em) return toast.error("Missing email.");
    window.open(`/org/prescriptions?athleteEmail=${encodeURIComponent(em)}`, "_blank", "noopener,noreferrer");
  };

  const toggleDone = (id) => {
    setCoachState((prev) => {
      const next = { ...prev, done: { ...(prev?.done || {}) } };
      next.done[id] = !next.done[id];
      return next;
    });
  };

  const toggleStarred = (id) => {
    setCoachState((prev) => {
      const next = { ...prev, starred: { ...(prev?.starred || {}) } };
      next.starred[id] = !next.starred[id];
      return next;
    });
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const a of paged) next.add(a.id);
      return next;
    });
    toast.success("Selected page");
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    toast.success("Selection cleared");
  };

  const exportCsv = (rows, filenamePrefix) => {
    const header = ["Name", "Email", "Title", "CreatedAt", "Done", "Starred", "CoachNote"].join(",");
    const lines = rows.map((a) => {
      const done    = coachState?.done?.[a.id]    ? "Yes" : "No";
      const starred = coachState?.starred?.[a.id] ? "Yes" : "No";
      const note    = cleanString(coachState?.notes?.[a.id] || "");
      return [
        safeCsvCell(a.name),
        safeCsvCell(a.email || ""),
        safeCsvCell(a.title || ""),
        safeCsvCell(a.createdAt ? formatDateTime(a.createdAt) : ""),
        safeCsvCell(done),
        safeCsvCell(starred),
        safeCsvCell(note),
      ].join(",");
    });
    const content = [header, ...lines].join("\n");
    downloadTextFile(
      `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`,
      content,
      "text/csv;charset=utf-8"
    );
  };

  const exportSelectedCsv = () => {
    if (!selectedList.length) return toast.error("No athletes selected.");
    exportCsv(selectedList, "selected_athletes");
    toast.success("Exported selected CSV");
  };

  const exportFilteredCsv = () => {
    if (!filtered.length) return toast.error("Nothing to export.");
    exportCsv(filtered, "athletes_filtered");
    toast.success("Exported filtered CSV");
  };

  const copySelectedEmails = () => {
    if (!selectedEmails.length) return toast.error("No emails selected.");
    copyText(selectedEmails.join(", "), "Emails copied");
  };

  const bulkOpenPrescriptions = async () => {
    if (!selectedEmails.length) return toast.error("Select athletes with emails first.");
    const limit = 12;
    const list  = selectedEmails.slice(0, limit);
    if (selectedEmails.length > 6) {
      const ok = window.confirm(`Open ${list.length} prescription tabs now? (We cap at ${limit} tabs.)`);
      if (!ok) return;
    }
    toast.success(`Opening ${list.length} tabs…`);
    for (let i = 0; i < list.length; i++) {
      await new Promise((r) => setTimeout(r, 140)); // eslint-disable-line no-await-in-loop
      openPrescriptionsNewTab(list[i]);
    }
    if (selectedEmails.length > limit)
      toast(`Opened first ${limit}. Export/copy emails for the rest.`, { icon: "ℹ️" });
  };

  const bulkMarkDone = (value) => {
    if (!selectedList.length) return toast.error("No athletes selected.");
    setCoachState((prev) => {
      const next = { ...prev, done: { ...(prev?.done || {}) } };
      for (const a of selectedList) next.done[a.id] = !!value;
      return next;
    });
    toast.success(value ? "Marked Done" : "Cleared Done");
  };

  const bulkStar = (value) => {
    if (!selectedList.length) return toast.error("No athletes selected.");
    setCoachState((prev) => {
      const next = { ...prev, starred: { ...(prev?.starred || {}) } };
      for (const a of selectedList) next.starred[a.id] = !!value;
      return next;
    });
    toast.success(value ? "Starred" : "Unstarred");
  };

  const toggleDoneAndMaybeAdvance = (id, advanceIfDone = true) => {
    const willBeDone = !coachState?.done?.[id];
    toggleDone(id);
    if (advanceIfDone && willBeDone) setTimeout(() => goNextAfter(id), 60);
  };

  const deleteAthlete = async (athleteId) => {
    if (!athleteId) throw new Error("No athlete ID provided.");
    const res  = await fetch("/api/org/deleteAthlete", {
      method:      "DELETE",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({ athleteId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Failed to delete athlete.");
    setCoachState((prev) => {
      const next = { ...prev };
      ["done", "starred", "notes"].forEach((k) => {
        if (next[k]) { next[k] = { ...next[k] }; delete next[k][athleteId]; }
      });
      return next;
    });
    setSelectedIds((prev) => {
      const next = new Set(prev); next.delete(athleteId); return next;
    });
    toast.success("Athlete removed from roster.");
    return data;
  };

  // ── Bulk set sport ────────────────────────────────────────────────────────
  const bulkSetSport = async (sport) => {
    if (!selectedList.length) return toast.error("No athletes selected.");
    if (!sport)                return toast.error("No sport selected.");

    const ids = selectedList.map(a => a.id);

    // Optimistic update — update local list immediately so UI reflects change
    setAthletesRaw?.(prev =>
      prev.map(a => ids.includes(a.id) ? { ...a, sport } : a)
    );

    try {
      const res = await fetch("/api/org/athlete/bulk-update", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ ids, fields: { sport } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to update sport.");
      toast.success(`Sport set to "${sport}" for ${ids.length} athlete${ids.length !== 1 ? "s" : ""}`);
    } catch (e) {
      // Roll back optimistic update on failure
      toast.error(e.message || "Sport update failed.");
    }
  };

  return {
    copyText,
    openPrescriptions,
    toggleDone,
    toggleStarred,
    toggleSelect,
    selectAllOnPage,
    clearSelection,
    exportSelectedCsv,
    exportFilteredCsv,
    copySelectedEmails,
    bulkOpenPrescriptions,
    bulkMarkDone,
    bulkStar,
    toggleDoneAndMaybeAdvance,
    deleteAthlete,
    bulkSetSport,   // ← new
  };
}