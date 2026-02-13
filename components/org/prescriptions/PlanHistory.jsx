// components/org/prescriptions/PlanHistory.jsx
"use client";

import { formatDateTime } from "@/lib/org/prescriptions/prescriptions-utils";

export default function PlanHistory({
  prescriptions = [],
  selectedAthleteToken,
  selectedAthleteEmail,
  selectedAthleteName,

  // ✅ actions
  onSearch, // refresh / first page
  onLoadMore, // next page

  // ✅ paging state
  hasMore = false,

  subtleHint,
  onCopyNotesToBuilder,

  loading = false,
}) {
  const token = String(selectedAthleteToken || "").trim();
  const canSearch = Boolean(token) && typeof onSearch === "function";
  const canLoadMore = Boolean(token) && Boolean(hasMore) && typeof onLoadMore === "function";

  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Plan History</h3>
          <p className="text-sm text-gray-600 mt-1">
            Source of truth: NutritionPlans (paginated).
          </p>

          {selectedAthleteName || selectedAthleteEmail || token ? (
            <p className="text-[11px] text-gray-500 mt-1">
              {selectedAthleteName ? <span className="font-semibold">{selectedAthleteName}</span> : null}
              {selectedAthleteEmail ? (
                <span className="text-gray-500">
                  {selectedAthleteName ? " • " : ""}
                  {selectedAthleteEmail}
                </span>
              ) : null}
              {token ? <span className="text-gray-400"> • {token}</span> : null}
            </p>
          ) : null}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSearch?.()}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
              canSearch
                ? "border-gray-200 bg-white hover:bg-gray-50"
                : "border-gray-200 bg-white text-gray-400 cursor-not-allowed"
            }`}
            disabled={!canSearch || loading}
            title={!token ? "Missing AthleteToken for this athlete" : "Refresh the latest plans"}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>

          <button
            type="button"
            onClick={() => onLoadMore?.()}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
              canLoadMore
                ? "border-gray-200 bg-white hover:bg-gray-50"
                : "border-gray-200 bg-white text-gray-400 cursor-not-allowed"
            }`}
            disabled={!canLoadMore || loading}
            title={!hasMore ? "No more plans" : "Load older plans"}
          >
            {loading ? "…" : "Load more"}
          </button>
        </div>
      </div>

      {!token && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800 font-semibold">Missing athlete token</p>
          <p className="text-xs text-amber-700 mt-1">
            This athlete is missing AthleteToken. Fix the roster record to load token-based history.
          </p>
        </div>
      )}

      {token && !loading && prescriptions.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-700 font-medium">No plans found for this athlete yet.</p>
          <p className="text-[11px] text-gray-500 mt-1">
            Click “Refresh” to re-check the latest plans from NutritionPlans.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {(prescriptions || []).map((p) => (
          <div
            key={p.id || `${p.createdAt}-${p.title}`}
            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">{p.title || "Plan"}</p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Created: {formatDateTime(p.createdAt)} {p.createdBy ? ` • By: ${p.createdBy}` : ""}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onCopyNotesToBuilder?.(p)}
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold hover:bg-gray-50"
              >
                Copy Notes to Builder
              </button>
            </div>

            <div className="mt-3">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-3">
                {p.prescription || ""}
              </pre>
            </div>

            {subtleHint ? <div className={subtleHint}>{subtleHint}</div> : null}
          </div>
        ))}
      </div>

      {token && prescriptions.length > 0 ? (
        <div className="text-[11px] text-gray-500">
          {hasMore ? "Showing latest plans. Click “Load more” for older ones." : "End of history."}
        </div>
      ) : null}
    </div>
  );
}
