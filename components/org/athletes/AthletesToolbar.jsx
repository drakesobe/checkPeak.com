// components/org/athletes/AthletesToolbar.jsx
"use client";

export default function AthletesToolbar({
  cardClass,
  inputClass,
  error,
  query,
  setQuery,
  sortKey,
  setSortKey,
  sortDir,
  toggleSortDir,
  pageSize,
  setPageSize,
  onReset,
  filter,
  setFilter,
  stats,
  pagedCount,
  filteredCount,
  selectedCount,
  safePage,
  totalPages,
  onPrevPage,
  onNextPage,
  searchRef,
}) {
  return (
    <div className={`${cardClass} p-5 space-y-4`}>
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-800">Error</p>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      )}

      <div className="grid md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-6">
          <input
            ref={searchRef}
            className={inputClass}
            placeholder="Search name, email, title… (press /)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="md:col-span-3 flex gap-2">
          <select
            className="w-full px-3 py-3 rounded-xl border border-gray-300 bg-white text-sm"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
          >
            <option value="createdAt">Sort: Created</option>
            <option value="name">Sort: Name</option>
            <option value="email">Sort: Email</option>
          </select>

          <button
            type="button"
            className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
            onClick={toggleSortDir}
            title="Toggle sort direction"
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>

        <div className="md:col-span-3 flex gap-2">
          <select
            className="w-full px-3 py-3 rounded-xl border border-gray-300 bg-white text-sm"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) || 50)}
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>

          <button
            type="button"
            className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
            onClick={onReset}
            title="Reset filters"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: `All (${stats.total})` },
          { key: "ready", label: `Ready (${stats.ready})` },
          { key: "incomplete", label: `Incomplete (${stats.incomplete})` },
          { key: "done", label: `Done (${stats.doneCount})` },
          { key: "starred", label: `Starred (${stats.starredCount})` },
        ].map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setFilter(x.key)}
            className={`px-3 py-2 rounded-xl text-sm font-semibold border ${
              filter === x.key
                ? "bg-[#46769B] text-white border-[#46769B]"
                : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Showing <span className="font-semibold">{pagedCount}</span> of{" "}
          <span className="font-semibold">{filteredCount}</span> (filtered) • Selected{" "}
          <span className="font-semibold">{selectedCount}</span>
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
            onClick={onPrevPage}
            disabled={safePage <= 1}
          >
            Prev
          </button>
          <span className="text-sm text-gray-600">
            Page <span className="font-semibold">{safePage}</span> /{" "}
            <span className="font-semibold">{totalPages}</span>
          </span>
          <button
            type="button"
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
            onClick={onNextPage}
            disabled={safePage >= totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}