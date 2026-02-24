"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import TrainersTable from "@/components/org/trainers/TrainersTable";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function TeamTableCard({
  title = "Team",
  subtitle = "",
  hint = "",
  rows = [],
  loading = false,
  canManage = false,
  onEditSave,
  onRemoveClick,
}) {
  const [search, setSearch] = useState("");

  const inputBase =
    "w-full max-w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/25";

  const filtered = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    const q = String(search || "").trim().toLowerCase();
    if (!q) return list;

    return list.filter((t) => {
      const hay = [t?.Name, t?.Email, t?.Role, t?.Active ? "active" : "inactive"]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const countLabel = useMemo(() => {
    if (loading) return "Loading…";
    return `${filtered.length}${rows?.length !== filtered.length ? ` / ${rows.length}` : ""}`;
  }, [filtered.length, rows, loading]);

  return (
    <section
      className={cx(
        "w-full max-w-full",
        "bg-white rounded-2xl shadow-md border border-blue-100",
        "p-4 sm:p-6",
        "overflow-x-hidden"
      )}
    >
      {/* Header + Search */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold truncate">{title}</h2>
            <span className="text-[11px] font-semibold text-gray-500 shrink-0">({countLabel})</span>
          </div>

          {subtitle ? <p className="text-sm text-gray-600 mt-1 leading-snug break-words">{subtitle}</p> : null}
          {hint ? <p className="text-[11px] text-gray-500 mt-1 leading-snug break-words">{hint}</p> : null}
        </div>

        {/* Search */}
        <div className="w-full sm:w-[460px] min-w-0">
          <div className="relative min-w-0">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className={cx(inputBase, "pl-10")}
              placeholder="Search by name, email, role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={loading}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-gray-500">{search ? "Filter active" : "Tip: search “inactive”"}</p>
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[11px] font-semibold text-[#46769B] hover:underline"
                disabled={loading}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Table / Cards */}
      <div className="mt-5">
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden min-w-0">
          {/* 
            ✅ Allow horizontal scroll ONLY if needed, and only for desktop sizing.
            On mobile, TrainersTable should render cards (sm:hidden) so no scroll is needed.
          */}
          <div className="overflow-x-auto min-w-0">
            {/* ✅ key fix: min-width only on sm+ (desktop table readability) */}
            <div className="sm:min-w-[720px] min-w-0">
              <TrainersTable
                trainers={filtered}
                loading={loading}
                canManage={canManage}
                onEditSave={onEditSave}
                onRemoveClick={onRemoveClick}
              />
            </div>
          </div>
        </div>

        {/* Mobile hint */}
        <p className="text-[11px] text-gray-500 mt-2 sm:hidden">
          Everything should fit on mobile (cards). If you still see a table, the desktop view isn’t being hidden.
        </p>
      </div>
    </section>
  );
}