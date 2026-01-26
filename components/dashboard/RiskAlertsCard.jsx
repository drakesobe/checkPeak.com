"use client";

import { AlertTriangle } from "lucide-react";

export default function RiskAlertsCard({ flaggedCount = 0, onReview }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          Risk & alerts
        </p>
      </div>

      {flaggedCount === 0 ? (
        <p className="text-xs text-gray-600">
          No scans currently flagged. Always verify with your governing body.
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-700">
            You have{" "}
            <span className="font-semibold text-amber-700">
              {flaggedCount} flagged scan{flaggedCount > 1 ? "s" : ""}
            </span>{" "}
            that should be reviewed before use.
          </p>

          <button
            onClick={onReview}
            className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 hover:underline"
          >
            Review flagged scans →
          </button>
        </>
      )}

      <p className="mt-3 text-[10px] text-gray-400">
        PEAK does not replace official rulings or medical advice.
      </p>
    </div>
  );
}
