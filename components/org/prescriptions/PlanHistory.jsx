// components/org/prescriptions/PlanHistory.jsx
"use client";

import { formatDateTime } from "@/lib/org/prescriptions/prescriptions-utils";

export default function PlanHistory({
  prescriptions = [],
  selectedAthleteEmail,
  onRefresh,
  subtleHint,
  onCopyNotesToBuilder,
}) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Plan History</h3>
          <p className="text-sm text-gray-600 mt-1">Newest first. (Legacy prescriptions)</p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
          disabled={!selectedAthleteEmail}
        >
          Refresh
        </button>
      </div>

      {!selectedAthleteEmail && <p className="text-sm text-gray-600">Select an athlete to view plan history.</p>}

      {selectedAthleteEmail && prescriptions.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-700 font-medium">No plans yet.</p>
          <p className="text-[11px] text-gray-500 mt-1">Switch to Builder to create the first plan.</p>
        </div>
      )}

      <div className="space-y-3">
        {(prescriptions || []).map((p) => (
          <div key={p.id || `${p.createdAt}-${p.title}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
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

            <div className={subtleHint}>
              Next: we’ll migrate history to NutritionPlans so it can rehydrate structured Phase + PlanJson too.
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
