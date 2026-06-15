"use client";

import { useMemo, useState } from "react";
import { normalizeReviewStatus } from "@/components/org/reviewQueue/reviewQueue.helpers";

export function useReviewQueueFilters(items) {
  const [search,     setSearch]     = useState("");
  const [filterMode, setFilterMode] = useState("pending"); // pending | needs_info | approved | all
  const [sortMode,   setSortMode]   = useState("newest");  // newest | oldest
  const [typeFilter, setTypeFilter] = useState("all");     // all | workout | class
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");

  const filtered = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    let list = Array.isArray(items) ? [...items] : [];

    if (q) {
      list = list.filter((it) => {
        const hay = [
          it?.title, it?.date, it?.status, it?.reviewStatus,
          it?.attachmentSummary, it?.athleteName, it?.athleteEmail,
          it?.coachNotes, it?.type,
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
    }

    const want = String(filterMode || "pending").toLowerCase();
    if (want !== "all") {
      list = list.filter((it) => normalizeReviewStatus(it?.reviewStatus) === want);
    }

    if (typeFilter !== "all") {
      list = list.filter((it) => (it?.type || "workout") === typeFilter);
    }

    if (dateFrom || dateTo) {
      list = list.filter((it) => {
        const d = it?.createdAt || it?.date;
        if (!d) return true;
        const t = new Date(d).getTime();
        if (dateFrom && t < new Date(dateFrom).getTime())             return false;
        if (dateTo   && t > new Date(dateTo + "T23:59:59").getTime()) return false;
        return true;
      });
    }

    list.sort((a, b) => {
      const at = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortMode === "oldest" ? at - bt : bt - at;
    });

    return list;
  }, [items, search, filterMode, sortMode, typeFilter, dateFrom, dateTo]);

  return {
    search,     setSearch,
    filterMode, setFilterMode,
    sortMode,   setSortMode,
    typeFilter, setTypeFilter,
    dateFrom,   setDateFrom,
    dateTo,     setDateTo,
    filtered,
  };
}
