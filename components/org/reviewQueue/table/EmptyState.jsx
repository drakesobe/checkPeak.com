// components/org/reviewQueue/table/EmptyState.jsx
"use client";

import { Inbox, RefreshCcw } from "lucide-react";

/**
 * EmptyState (table)
 * - Minimal + clean
 * - Works inside <tbody> (returns a <tr>)
 * - Small icon + short guidance
 */
export default function EmptyState({
  colSpan = 8,
  title = "No items found",
  hint = "Try Refresh, or switch filters (Pending / Needs info / All).",
  onRefresh,
  loading = false,
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10">
        <div className="mx-auto max-w-md text-center px-4">
          <div className="mx-auto w-11 h-11 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center">
            <Inbox className="w-5 h-5 text-gray-400" />
          </div>

          <div className="mt-3 text-sm font-semibold text-gray-900">{title}</div>
          <div className="mt-1 text-[12px] text-gray-500 leading-relaxed">{hint}</div>

          {onRefresh ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-800 disabled:opacity-60"
              >
                <RefreshCcw className={loading ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
