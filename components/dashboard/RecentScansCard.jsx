"use client";

import { AlertTriangle } from "lucide-react";

export default function RecentScansCard({
  scans = [],
  loading = false,
  formatDate,
  onOpen,
  onViewAll,
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Recent scans</h2>
        {scans.length > 0 && (
          <button
            onClick={onViewAll}
            className="text-[11px] font-medium text-blue-700 hover:underline"
          >
            View all
          </button>
        )}
      </div>

      {loading && scans.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-500">
          Loading scans…
        </div>
      ) : scans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-xs text-gray-500">
          No scans yet.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          {scans.slice(0, 5).map((scan) => (
            <div
              key={scan.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {scan.displayName}
                </p>
                <p className="text-[11px] text-gray-500">
                  {formatDate(scan.parsedDate)}
                </p>
                {scan.hasBanned && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 mt-1">
                    <AlertTriangle className="w-3 h-3" />
                    Potential issue
                  </span>
                )}
              </div>

              <button
                onClick={() => onOpen(scan)}
                className="text-[11px] font-medium text-blue-700 hover:underline"
              >
                View
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
