// components/org/reviewQueue/ReviewQueueControls.jsx
"use client";

import { useCallback, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  HelpCircle,
  Search,
  X,
  ArrowUpDown,
  Clock,
} from "lucide-react";
import { Button, Pill, classNames } from "@/components/org/reviewQueue/ui";

/**
 * ReviewQueueControls
 * UX goals:
 * - Clean, workbench-like control surface (search + filter + sort)
 * - Mobile-first spacing (no cramped chips, no giant side panel feel)
 * - Quick actions: clear search, visible active state, compact toggles
 * - Reduce duplication: stats live in ReviewQueueStats; controls should focus on *controlling the list*
 *
 * Design:
 * - Left: small "Queue" label + micro guidance + optional compact counts row (kept subtle)
 * - Right: search input with clear button + filter segmented buttons + sort toggle
 *
 * Notes:
 * - If you decide counts are already shown in ReviewQueueStats, you can hide `showCounts` by default.
 */

function safeNum(v) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function SegButton({ active, children, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cx(
        "inline-flex items-center justify-center gap-1.5",
        "px-3 py-2 rounded-xl text-xs font-semibold transition",
        "border",
        active
          ? "bg-[#46769B] text-white border-[#46769B] shadow-sm"
          : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
      )}
      aria-pressed={Boolean(active)}
    >
      {children}
    </button>
  );
}

function TogglePill({ active, onClick, icon: Icon, children, title, tone = "base" }) {
  const toneCls =
    tone === "pending"
      ? "border-sky-200 bg-sky-50/70 text-sky-900"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50/70 text-amber-900"
      : tone === "ok"
      ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
      : "border-gray-200 bg-gray-50 text-gray-800";

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cx(
        "inline-flex items-center gap-1.5",
        "px-3 py-1.5 rounded-full text-xs font-semibold border transition",
        active ? "ring-2 ring-[#46769B]/25" : "",
        active ? "bg-white" : toneCls,
        "hover:brightness-[0.98]"
      )}
      aria-pressed={Boolean(active)}
    >
      {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
      {children}
    </button>
  );
}

export default function ReviewQueueControls({
  counts,
  search,
  setSearch,
  filterMode,
  setFilterMode,
  sortMode,
  setSortMode,

  // Optional: hide counts if you already show them in ReviewQueueStats
  showCounts = false,
}) {
  const pending = safeNum(counts?.pending);
  const needsInfo = safeNum(counts?.needsInfo);
  const approved = safeNum(counts?.approved);

  const inputBase =
    "w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  const hasSearch = useMemo(() => Boolean(String(search || "").trim()), [search]);

  const onClearSearch = useCallback(() => {
    setSearch("");
  }, [setSearch]);

  const onToggleSort = useCallback(() => {
    setSortMode((prev) => (prev === "newest" ? "oldest" : "newest"));
  }, [setSortMode]);

  const sortLabel = sortMode === "newest" ? "Newest first" : "Oldest first";

  return (
    <div className="space-y-4">
      {/* Top row: minimal label + optional counts + sort */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-extrabold text-gray-900">Queue</h2>
            <span className="text-xs text-gray-400">•</span>
            <p className="text-xs sm:text-sm text-gray-600">
              Review uploads and confirm the athlete’s workout.
            </p>
          </div>

          {/* Optional compact counts row (kept subtle, doesn’t fight stats section) */}
          {showCounts ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill tone="warn">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                Pending: {pending}
              </Pill>
              <Pill tone="warn">
                <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
                Needs info: {needsInfo}
              </Pill>
              <Pill tone="good">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Approved: {approved}
              </Pill>
            </div>
          ) : null}
        </div>

        {/* Sort toggle (compact, single control) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSort}
            className={cx(
              "inline-flex items-center justify-center gap-2",
              "px-3.5 py-2 rounded-2xl border border-gray-200",
              "bg-white hover:bg-gray-50 transition",
              "text-sm font-semibold text-gray-800"
            )}
            title="Toggle sort"
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortLabel}
          </button>

          <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
            <Clock className="w-3.5 h-3.5" />
            Sort by submit time
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          className={classNames(inputBase, "pl-11 pr-12")}
          placeholder="Search title, date, athlete, summary…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {hasSearch ? (
          <button
            type="button"
            onClick={onClearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center"
            title="Clear search"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        ) : null}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Filter segmented buttons */}
        <div className="flex flex-wrap gap-2">
          <SegButton active={filterMode === "pending"} onClick={() => setFilterMode("pending")} title="Show pending">
            <Filter className="w-4 h-4" />
            Pending
          </SegButton>

          <SegButton
            active={filterMode === "needs_info"}
            onClick={() => setFilterMode("needs_info")}
            title="Show needs info"
          >
            Needs info
          </SegButton>

          <SegButton active={filterMode === "approved"} onClick={() => setFilterMode("approved")} title="Show approved">
            Approved
          </SegButton>

          <SegButton active={filterMode === "all"} onClick={() => setFilterMode("all")} title="Show all">
            All
          </SegButton>
        </div>

        {/* Quick glance: small pills that also act as filters (nice on mobile) */}
        <div className="flex flex-wrap gap-2">
          <TogglePill
            active={filterMode === "pending"}
            onClick={() => setFilterMode("pending")}
            icon={AlertTriangle}
            tone="pending"
            title="Pending"
          >
            {pending}
          </TogglePill>

          <TogglePill
            active={filterMode === "needs_info"}
            onClick={() => setFilterMode("needs_info")}
            icon={HelpCircle}
            tone="warn"
            title="Needs info"
          >
            {needsInfo}
          </TogglePill>

          <TogglePill
            active={filterMode === "approved"}
            onClick={() => setFilterMode("approved")}
            icon={CheckCircle2}
            tone="ok"
            title="Approved"
          >
            {approved}
          </TogglePill>
        </div>
      </div>

      {/* Micro-helper row */}
      <div className="text-xs text-gray-500 leading-relaxed">
        Tip: Start with <span className="font-semibold text-gray-700">Pending</span>, then move to{" "}
        <span className="font-semibold text-gray-700">Needs info</span> for resubmits.
      </div>
    </div>
  );
}
