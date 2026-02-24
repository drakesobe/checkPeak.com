"use client";

import { useMemo } from "react";
import { Users, Mail, AlertTriangle, CheckCircle2, Star } from "lucide-react";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function StatCard({ icon: Icon, label, value, sub, tone = "base" }) {
  const toneCls =
    tone === "ok"
      ? "border-emerald-100 bg-emerald-50/40"
      : tone === "warn"
      ? "border-amber-100 bg-amber-50/40"
      : tone === "blue"
      ? "border-blue-100 bg-blue-50/40"
      : "border-gray-100 bg-white";

  const iconCls =
    tone === "ok"
      ? "text-emerald-700 bg-emerald-50 border-emerald-100"
      : tone === "warn"
      ? "text-amber-800 bg-amber-50 border-amber-100"
      : tone === "blue"
      ? "text-[#46769B] bg-blue-50 border-blue-100"
      : "text-[#46769B] bg-blue-50 border-blue-100";

  return (
    <div
      className={cx(
        "rounded-2xl border shadow-sm overflow-hidden",
        "transition hover:shadow-md hover:border-gray-200",
        toneCls
      )}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500">{label}</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-1 leading-none">{value}</p>
            {sub ? <p className="text-[11px] text-gray-600 mt-2 leading-snug">{sub}</p> : null}
          </div>

          <span className={cx("shrink-0 h-10 w-10 rounded-2xl border flex items-center justify-center", iconCls)}>
            <Icon className="w-5 h-5" />
          </span>
        </div>
      </div>

      {/* subtle bottom accent */}
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#46769B]/35 to-transparent" />
    </div>
  );
}

export default function AthletesStats({ stats }) {
  const s = stats || {};
  const total = Number(s.total || 0);
  const ready = Number(s.ready || 0);
  const incomplete = Number(s.incomplete || 0);
  const done = Number(s.doneCount || 0);
  const starred = Number(s.starredCount || 0);

  const readyPct = useMemo(() => {
    if (!total) return 0;
    return Math.round((ready / total) * 100);
  }, [ready, total]);

  const donePct = useMemo(() => {
    if (!total) return 0;
    return Math.round((done / total) * 100);
  }, [done, total]);

  const items = [
    {
      key: "total",
      label: "Total",
      value: total,
      sub: "All athletes in this org",
      icon: Users,
      tone: "blue",
    },
    {
      key: "ready",
      label: "Ready",
      value: ready,
      sub: total ? `${readyPct}% have email` : "Email present",
      icon: Mail,
      tone: ready > 0 ? "ok" : "base",
    },
    {
      key: "incomplete",
      label: "Incomplete",
      value: incomplete,
      sub: incomplete ? "Missing email (needs cleanup)" : "All set",
      icon: AlertTriangle,
      tone: incomplete > 0 ? "warn" : "ok",
    },
    {
      key: "done",
      label: "Done",
      value: done,
      sub: total ? `${donePct}% marked done` : "Coach progress",
      icon: CheckCircle2,
      tone: done > 0 ? "blue" : "base",
    },
    {
      key: "starred",
      label: "Starred",
      value: starred,
      sub: starred ? "Priority athletes" : "No priorities yet",
      icon: Star,
      tone: starred > 0 ? "blue" : "base",
    },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {items.map((x) => (
        <StatCard
          key={x.key}
          icon={x.icon}
          label={x.label}
          value={x.value}
          sub={x.sub}
          tone={x.tone}
        />
      ))}
    </div>
  );
}