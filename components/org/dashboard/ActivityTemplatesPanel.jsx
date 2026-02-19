// components/org/dashboard/ActivityTemplatesPanel.jsx
"use client";

import { useMemo } from "react";
import { RefreshCcw, ArrowRight } from "lucide-react";
import { Button, Pill } from "@/components/org/dashboard/DashboardUI";
import { fmtDate } from "@/lib/org/dashboard-utils";

function ActivityItem({ it, onViewHistory }) {
  const email = String(it?.athleteEmail || "").trim().toLowerCase();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-extrabold text-gray-900 break-words">{it?.title || "Plan"}</p>
      <p className="text-[12px] text-gray-700 mt-1 break-all">
        <span className="font-semibold">{email || "—"}</span>
      </p>
      <p className="text-[11px] text-gray-500 mt-2">
        {it?.createdAt ? `Created: ${fmtDate(it.createdAt)}` : "—"}
        {it?.createdBy ? ` • By: ${it.createdBy}` : ""}
      </p>

      <div className="mt-3">
        <Button
          variant="secondary"
          className="px-3 py-2 text-xs w-full sm:w-auto"
          onClick={() => onViewHistory?.(email)}
          disabled={!email}
        >
          View History
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function TemplateItem({ t, onUseTemplate }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-extrabold text-gray-900 break-words">{t?.name || "Template"}</p>
      {t?.desc ? <p className="text-[12px] text-gray-600 mt-1 break-words">{t.desc}</p> : null}

      <div className="mt-3">
        <Button className="px-3 py-2 text-xs w-full sm:w-auto" onClick={() => onUseTemplate?.(t.id)} disabled={!t?.id}>
          Use template
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default function ActivityTemplatesPanel({
  loading,
  recentActivity = [],
  templates = [],
  onRefreshActivity,
  onRefreshTemplates,
  onViewHistory,
  onUseTemplate,
  activityLimit = 6,
  templateLimit = 6,
}) {
  const activity = useMemo(
    () => (Array.isArray(recentActivity) ? recentActivity.slice(0, activityLimit) : []),
    [recentActivity, activityLimit]
  );

  const templ = useMemo(
    () => (Array.isArray(templates) ? templates.slice(0, templateLimit) : []),
    [templates, templateLimit]
  );

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-4 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold">Activity & Templates</h2>
          <p className="text-sm text-gray-600 mt-1">Reference what happened recently, then build faster with templates.</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Pill>{Array.isArray(recentActivity) ? recentActivity.length : 0} activity</Pill>
            <Pill>{Array.isArray(templates) ? templates.length : 0} templates</Pill>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:flex lg:justify-end">
          <Button
            variant="secondary"
            className="w-full px-3 py-2 text-xs"
            onClick={onRefreshActivity}
            disabled={loading}
            title="Refresh recent activity"
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh activity
          </Button>

          <Button
            variant="secondary"
            className="w-full px-3 py-2 text-xs"
            onClick={onRefreshTemplates}
            disabled={loading}
            title="Refresh templates"
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh templates
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-extrabold text-gray-900">Recent Activity</p>
            <p className="text-[11px] text-gray-500">Top {activityLimit}</p>
          </div>

          <div className="mt-3 space-y-3">
            {activity.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-sm font-extrabold text-gray-900">No activity yet</p>
                <p className="text-[11px] text-gray-500 mt-1">Create a plan to start tracking events here.</p>
              </div>
            ) : (
              activity.map((it, idx) => (
                <ActivityItem
                  key={`${it?.athleteEmail || "athlete"}-${it?.createdAt || idx}-${idx}`}
                  it={it}
                  onViewHistory={onViewHistory}
                />
              ))
            )}
          </div>
        </div>

        {/* Templates */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-extrabold text-gray-900">Templates</p>
            <p className="text-[11px] text-gray-500">Top {templateLimit}</p>
          </div>

          <div className="mt-3 space-y-3">
            {templ.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-sm font-extrabold text-gray-900">No templates yet</p>
                <p className="text-[11px] text-gray-500 mt-1">Create templates to speed up plan building.</p>
              </div>
            ) : (
              templ.map((t) => <TemplateItem key={t.id || t.name} t={t} onUseTemplate={onUseTemplate} />)
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
