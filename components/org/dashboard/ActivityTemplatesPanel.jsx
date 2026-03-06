// components/org/dashboard/ActivityTemplatesPanel.jsx
"use client";

import { useMemo } from "react";
import { RefreshCcw, ArrowRight, Clock, Layers } from "lucide-react";
import { DS, Button } from "@/components/org/dashboard/DashboardUI";
import { fmtDate } from "@/lib/org/dashboard-utils";

function ActivityRow({ it, onViewHistory }) {
  const email = String(it?.athleteEmail || "").trim().toLowerCase();
  return (
    <div
      className="flex items-start justify-between gap-3 px-3 py-2.5"
      style={{ borderBottom: `1px solid ${DS.border}` }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black truncate" style={{ color: DS.bodyText }}>{it?.title || "Plan"}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: DS.labelText }}>{email || "—"}</p>
        <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>
          {it?.createdAt ? fmtDate(it.createdAt) : "—"}
          {it?.createdBy ? ` · ${it.createdBy}` : ""}
        </p>
      </div>
      <Button variant="secondary" onClick={() => onViewHistory?.(email)} disabled={!email}>
        History <ArrowRight className="w-3 h-3" />
      </Button>
    </div>
  );
}

function TemplateRow({ t, onUseTemplate }) {
  return (
    <div
      className="flex items-start justify-between gap-3 px-3 py-2.5"
      style={{ borderBottom: `1px solid ${DS.border}` }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black truncate" style={{ color: DS.bodyText }}>{t?.name || "Template"}</p>
        {t?.desc && <p className="text-xs mt-0.5 truncate" style={{ color: DS.dimText }}>{t.desc}</p>}
      </div>
      <Button onClick={() => onUseTemplate?.(t.id)} disabled={!t?.id}>
        Use <ArrowRight className="w-3 h-3" />
      </Button>
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
  const activity = useMemo(() =>
    (Array.isArray(recentActivity) ? recentActivity : []).slice(0, activityLimit),
    [recentActivity, activityLimit]
  );
  const templ = useMemo(() =>
    (Array.isArray(templates) ? templates : []).slice(0, templateLimit),
    [templates, templateLimit]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

      {/* Recent Activity */}
      <section style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}` }}>
        <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${DS.border}` }}>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0" style={{ color: DS.brand }} />
            <span className="text-xs font-black uppercase tracking-wider" style={{ color: DS.brand }}>
              Recent Activity
            </span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: DS.pageBg, color: DS.labelText, border: `1px solid ${DS.border}` }}>
              {recentActivity.length}
            </span>
          </div>
          <Button variant="secondary" onClick={onRefreshActivity} disabled={loading}>
            <RefreshCcw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

        <div>
          {activity.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs font-bold" style={{ color: DS.dimText }}>No activity yet</p>
              <p className="text-xs mt-1" style={{ color: DS.dimText }}>Create a plan to start tracking events here.</p>
            </div>
          ) : (
            activity.map((it, idx) => (
              <ActivityRow
                key={`${it?.athleteEmail || "a"}-${it?.createdAt || idx}-${idx}`}
                it={it}
                onViewHistory={onViewHistory}
              />
            ))
          )}
        </div>
      </section>

      {/* Templates */}
      <section style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}` }}>
        <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${DS.border}` }}>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 shrink-0" style={{ color: DS.brand }} />
            <span className="text-xs font-black uppercase tracking-wider" style={{ color: DS.brand }}>
              Templates
            </span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: DS.pageBg, color: DS.labelText, border: `1px solid ${DS.border}` }}>
              {templates.length}
            </span>
          </div>
          <Button variant="secondary" onClick={onRefreshTemplates} disabled={loading}>
            <RefreshCcw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

        <div>
          {templ.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs font-bold" style={{ color: DS.dimText }}>No templates yet</p>
              <p className="text-xs mt-1" style={{ color: DS.dimText }}>Build a plan and save it as a template to speed up future prescriptions.</p>
            </div>
          ) : (
            templ.map((t) => (
              <TemplateRow key={t.id || t.name} t={t} onUseTemplate={onUseTemplate} />
            ))
          )}
        </div>
      </section>

    </div>
  );
}