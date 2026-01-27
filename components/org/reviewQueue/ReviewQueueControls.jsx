// components/org/reviewQueue/ReviewQueueControls.jsx
"use client";

import { AlertTriangle, CheckCircle2, Filter, HelpCircle, Search } from "lucide-react";
import { Button, Pill, classNames } from "@/components/org/reviewQueue/ui";

export default function ReviewQueueControls({
  counts,
  search,
  setSearch,
  filterMode,
  setFilterMode,
  sortMode,
  setSortMode,
}) {
  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div>
        <h2 className="text-lg font-extrabold">Queue</h2>
        <p className="text-sm text-gray-600 mt-1">Review uploads and confirm the athlete’s workout.</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Pill tone="warn">
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
            Pending: {counts.pending}
          </Pill>
          <Pill tone="warn">
            <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
            Needs info: {counts.needsInfo}
          </Pill>
          <Pill tone="good">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            Approved: {counts.approved}
          </Pill>
        </div>
      </div>

      <div className="w-full sm:w-[460px] space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className={classNames(inputBase, "pl-10")}
            placeholder="Search by title, date, athlete, summary…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterMode === "pending" ? "primary" : "secondary"}
            className="px-3 py-2 text-xs"
            onClick={() => setFilterMode("pending")}
          >
            <Filter className="w-4 h-4" /> Pending
          </Button>
          <Button
            variant={filterMode === "needs_info" ? "primary" : "secondary"}
            className="px-3 py-2 text-xs"
            onClick={() => setFilterMode("needs_info")}
          >
            Needs Info
          </Button>
          <Button
            variant={filterMode === "approved" ? "primary" : "secondary"}
            className="px-3 py-2 text-xs"
            onClick={() => setFilterMode("approved")}
          >
            Approved
          </Button>
          <Button
            variant={filterMode === "all" ? "primary" : "secondary"}
            className="px-3 py-2 text-xs"
            onClick={() => setFilterMode("all")}
          >
            All
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={sortMode === "newest" ? "primary" : "secondary"}
            className="px-3 py-2 text-xs"
            onClick={() => setSortMode("newest")}
          >
            Newest
          </Button>
          <Button
            variant={sortMode === "oldest" ? "primary" : "secondary"}
            className="px-3 py-2 text-xs"
            onClick={() => setSortMode("oldest")}
          >
            Oldest
          </Button>
        </div>
      </div>
    </div>
  );
}
