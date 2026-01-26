// /components/dashboard/SavedStacksCard.jsx
"use client";

import { Sparkles } from "lucide-react";

export default function SavedStacksCard({
  stacks = [],
  loading = false,
  onManage,
  onExplore,
}) {
  const count = stacks.length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Saved stacks</h2>
          {count > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">
              {count}
            </span>
          )}
        </div>

        {count > 0 && (
          <button
            onClick={onManage}
            className="text-[11px] font-medium text-blue-700 hover:underline"
          >
            Manage
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && count === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 text-xs text-gray-500">
          Loading saved stacks…
        </div>
      ) : count === 0 ? (
        /* Empty */
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white/70 p-4 text-xs text-gray-500">
          <p className="font-medium text-gray-700 mb-1">
            No stacks saved yet.
          </p>
          <p className="mb-3">
            Save stacks from SmartStack to track ingredients you trust.
          </p>

          <button
            onClick={onExplore}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900 text-white text-[11px] font-medium hover:bg-gray-800 transition"
          >
            <Sparkles className="w-3 h-3" />
            Explore SmartStack
          </button>
        </div>
      ) : (
        /* List */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          {stacks.slice(0, 5).map((stack, idx) => {
            const title =
              stack.StackName ||
              stack.Name ||
              stack.name ||
              "Saved stack";

            const note =
              stack.Notes ||
              stack.note ||
              "Saved from SmartStack.";

            const category =
              stack.Category ||
              stack.category ||
              stack.Type ||
              null;

            return (
              <div
                key={stack.id || idx}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 hover:bg-gray-100 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar */}
                  <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-[11px] font-semibold text-blue-700 shrink-0">
                    {title[0]?.toUpperCase?.() || "S"}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {title}
                    </p>
                    <p className="text-[11px] text-gray-500 line-clamp-1">
                      {note}
                    </p>

                    {category && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-gray-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {category}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {count > 5 && (
            <p className="text-[11px] text-gray-500">
              + {count - 5} more saved stack{count - 5 > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
