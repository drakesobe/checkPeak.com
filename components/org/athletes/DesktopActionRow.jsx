"use client";

export default function DesktopActionRow({
  onSelectPage,
  onClearSelection,
  onExportFiltered,
  selectedCount,
}) {
  return (
    <div className="hidden md:flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSelectPage}
          className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
        >
          Select page
        </button>

        <button
          type="button"
          onClick={onClearSelection}
          className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
          disabled={selectedCount === 0}
        >
          Clear selection
        </button>

        <button
          type="button"
          onClick={onExportFiltered}
          className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
          title="Export the current filtered list"
        >
          Export filtered CSV
        </button>
      </div>
    </div>
  );
}