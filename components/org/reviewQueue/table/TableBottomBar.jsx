// components/org/reviewQueue/table/TableBottomBar.jsx
"use client";

import { ClipboardList, Info } from "lucide-react";
import { Pill, classNames } from "@/components/org/reviewQueue/ui";

/**
 * TableBottomBar
 * - A subtle footer/status bar for the queue list
 * - Shows "what you're seeing" + a quick toggle + optional micro tip
 * - Keeps the top of the list clean (controls live above)
 */
export default function TableBottomBar({
  count,
  onlyUnresolved,
  setOnlyUnresolved,

  // Optional toggles
  showTip = true,
  showCount = true,
}) {
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {showCount ? (
          <Pill tone="neutral">
            <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
            Showing <span className="ml-1 font-extrabold">{count}</span>
          </Pill>
        ) : null}

        <button
          type="button"
          onClick={() => setOnlyUnresolved((p) => !p)}
          className={classNames(
            "rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition",
            onlyUnresolved
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
          )}
        >
          {onlyUnresolved ? "Unresolved only" : "Show unresolved"}
        </button>
      </div>

      {showTip ? (
        <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-gray-400" />
          Tip: tap a row to expand. “Review” opens the full viewer.
        </div>
      ) : null}
    </div>
  );
}
