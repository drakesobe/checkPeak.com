// /components/dashboard/StatsGrid.jsx
"use client";

import { ScanBarcode, Activity, Bookmark, AlertTriangle } from "lucide-react";
import { StatCard } from "./ui";

export default function StatsGrid({ stats }) {
  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard
        label="Total scans"
        value={stats.totalScans}
        icon={<ScanBarcode className="w-4 h-4 text-blue-600" />}
        tone="primary"
        subLabel="All-time checks"
      />
      <StatCard
        label="Recent activity"
        value={stats.recentSearches}
        icon={<Activity className="w-4 h-4 text-indigo-600" />}
        tone="neutral"
        subLabel="Last 14 days"
      />
      <StatCard
        label="Saved stacks"
        value={stats.stacksSaved}
        icon={<Bookmark className="w-4 h-4 text-emerald-600" />}
        tone="success"
        subLabel="Tracking"
      />
      <StatCard
        label="Flagged scans"
        value={stats.flaggedScans}
        icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
        tone={stats.flaggedScans > 0 ? "warning" : "neutral"}
        subLabel="Needs review"
      />
    </section>
  );
}
