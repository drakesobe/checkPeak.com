// components/org/dashboard/RecentActivityPanel.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, ArrowRight, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { DS, Button } from "@/components/org/dashboard/DashboardUI";
import { fmtDate } from "@/lib/org/dashboard-utils";

export default function RecentActivityPanel({
  loading, recentActivity = [], onRefresh, onViewHistory, pageSize = 8,
}) {
  const [page, setPage] = useState(1);

  const safeList = useMemo(() =>
    Array.isArray(recentActivity) ? recentActivity : [], [recentActivity]);

  const totalPages = useMemo(() =>
    Math.max(1, Math.ceil(safeList.length / pageSize)), [safeList.length, pageSize]);

  useEffect(() => { setPage(1); }, [recentActivity]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const pageItems = useMemo(() =>
    safeList.slice((page - 1) * pageSize, page * pageSize), [safeList, page, pageSize]);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <section style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}` }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${DS.border}` }}>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 shrink-0" style={{ color: DS.brand }} />
          <span className="text-xs font-black uppercase tracking-wider" style={{ color: DS.brand }}>Recent Activity</span>
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: DS.pageBg, color: DS.labelText, border: `1px solid ${DS.border}` }}>
            {safeList.length} event{safeList.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: DS.dimText }}>pg {page}/{totalPages}</span>
          <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!canPrev}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button variant="secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={!canNext}>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
          <Button variant="secondary" onClick={onRefresh} disabled={loading}>
            <RefreshCcw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      <div>
        {safeList.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs font-bold" style={{ color: DS.dimText }}>No activity yet</p>
            <p className="text-xs mt-1" style={{ color: DS.dimText }}>Create a plan to start tracking events here.</p>
          </div>
        ) : (
          pageItems.map((it, idx) => (
            <div
              key={`${it?.athleteEmail || "a"}-${it?.createdAt || idx}-${idx}`}
              className="flex items-start justify-between gap-3 px-4 py-3"
              style={{ borderBottom: `1px solid ${DS.border}` }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black truncate" style={{ color: DS.bodyText }}>{it?.title || "Plan"}</p>
                <p className="text-xs mt-0.5 break-all" style={{ color: DS.labelText }}>{it?.athleteEmail || "—"}</p>
                <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>
                  {it?.createdAt ? fmtDate(it.createdAt) : "—"}
                  {it?.createdBy ? ` · ${it.createdBy}` : ""}
                </p>
              </div>
              <Button variant="secondary" onClick={() => onViewHistory?.(it?.athleteEmail)} disabled={!it?.athleteEmail}>
                History <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}