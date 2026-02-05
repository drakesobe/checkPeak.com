// /components/org/dashboard/RecentActivityPanel.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { fmtDate } from "@/lib/org/dashboard-utils";
import { Button, Pill } from "@/components/org/dashboard/DashboardUI";

export default function RecentActivityPanel({
  loading,
  recentActivity = [],
  onRefresh,
  onViewHistory,
  pageSize = 8, // <- change default here if you want
}) {
  const [page, setPage] = useState(1);

  // Reset to first page whenever data changes (refresh / org switch / etc.)
  useEffect(() => {
    setPage(1);
  }, [recentActivity]);

  const safeList = useMemo(
    () => (Array.isArray(recentActivity) ? recentActivity : []),
    [recentActivity]
  );

  const totalPages = useMemo(() => {
    const n = safeList.length;
    return Math.max(1, Math.ceil(n / pageSize));
  }, [safeList.length, pageSize]);

  // Keep page in bounds
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return safeList.slice(start, start + pageSize);
  }, [safeList, page, pageSize]);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold">Recent Activity</h2>
          <p className="text-sm text-gray-600 mt-1">Latest plan events.</p>
        </div>

        <Button
          variant="secondary"
          className="px-3 py-2 text-xs shrink-0"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Pager */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Pill>
            {safeList.length} event{safeList.length === 1 ? "" : "s"}
          </Pill>
          <Pill>
            Page {page} / {totalPages}
          </Pill>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="px-3 py-2 text-xs"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!canPrev}
            title="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </Button>

          <Button
            variant="secondary"
            className="px-3 py-2 text-xs"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={!canNext}
            title="Next"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {safeList.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-extrabold text-gray-900">No activity yet</p>
            <p className="text-[11px] text-gray-500 mt-1">
              Create a plan to start tracking actions here.
            </p>
          </div>
        ) : (
          pageItems.map((it, idx) => (
            <div
              key={`${it?.athleteEmail || "athlete"}-${it?.createdAt || idx}-${idx}`}
              className="rounded-2xl border border-gray-200 p-4"
            >
              <p className="text-sm font-extrabold text-gray-900 break-words">
                {it?.title || "Plan"}
              </p>

              <p className="text-[12px] text-gray-700 mt-1 break-all">
                <span className="font-semibold">{it?.athleteEmail || "—"}</span>
              </p>

              <p className="text-[11px] text-gray-500 mt-2">
                {it?.createdAt ? `Created: ${fmtDate(it.createdAt)}` : "—"}
                {it?.createdBy ? ` • By: ${it.createdBy}` : ""}
              </p>

              <div className="mt-3">
                <Button
                  variant="secondary"
                  className="px-3 py-2 text-xs w-full sm:w-auto"
                  onClick={() => onViewHistory(it?.athleteEmail)}
                  disabled={!it?.athleteEmail}
                >
                  View History
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
