"use client";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function ScanActivityCard({
  data = [],
  max = 1,
  loading = false,
  lastScanDate = null,
  formatDate,
  onView,
}) {
  const hasData = Array.isArray(data) && data.length > 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Scan activity
          </p>
          <p className="text-sm text-gray-700">Last 7 days</p>
        </div>

        <button
          onClick={onView}
          className="text-[11px] font-medium text-blue-700 hover:underline"
        >
          View
        </button>
      </div>

      {/* Body */}
      {!hasData ? (
        <div className="h-24 flex items-center justify-center text-xs text-gray-500">
          {loading ? "Syncing scan history…" : "No scans yet."}
        </div>
      ) : (
        <>
          <div className="flex h-24 items-end gap-2">
            {data.map((day, idx) => {
              const ratio = day.count / Math.max(1, max);
              const height = Math.max(8, ratio * 80);

              // Mobile label only on first & last
              const showMobileLabel = idx === 0 || idx === data.length - 1;

              return (
                <div
                  key={day.key}
                  className="flex flex-1 flex-col items-center"
                >
                  <div
                    className={classNames(
                      "w-4 sm:w-6 rounded-t-md transition-all",
                      day.count > 0
                        ? "bg-gradient-to-t from-blue-600 via-blue-500 to-indigo-400 shadow-md shadow-blue-200/60"
                        : "bg-gray-200"
                    )}
                    style={{ height: `${height}px` }}
                    title={`${day.label}: ${day.count} scan${
                      day.count === 1 ? "" : "s"
                    }`}
                  />

                  {/* Desktop label */}
                  <span className="hidden sm:block text-[10px] text-gray-500 mt-1">
                    {day.label}
                  </span>

                  {/* Mobile label (minimal) */}
                  <span
                    className={classNames(
                      "sm:hidden text-[10px] text-gray-500 mt-1",
                      showMobileLabel ? "block" : "invisible"
                    )}
                  >
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>

          {lastScanDate && (
            <p className="mt-2 text-[11px] text-gray-400">
              Last scan:{" "}
              <span className="font-medium text-gray-600">
                {formatDate(lastScanDate)}
              </span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
