// components/org/nutrition/page/OverviewPanel.jsx
"use client";

import { useMemo } from "react";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function fmtDateShort(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString();
  } catch {
    return String(v);
  }
}

function pct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function computeOverview(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const total = list.length;

  const withPlan = list.filter((r) => r?.hasPlan).length;
  const noPlan = total - withPlan;

  const missingCheckin = list.filter((r) => r?.missingCheckin).length;
  const lowAdherence = list.filter((r) => r?.lowAdherence).length;
  const needsAction = list.filter((r) => r?.needsAction).length;

  const withCheckin = list.filter((r) => r?.lastCheckin);
  const avgAdherence =
    withCheckin.length > 0
      ? Math.round(withCheckin.reduce((sum, r) => sum + pct(r?.adherenceAvg), 0) / withCheckin.length)
      : 0;

  const avgCalories =
    withCheckin.length > 0
      ? Math.round(withCheckin.reduce((sum, r) => sum + pct(r?.lastCheckin?.caloriesPct), 0) / withCheckin.length)
      : 0;

  const avgProtein =
    withCheckin.length > 0
      ? Math.round(withCheckin.reduce((sum, r) => sum + pct(r?.lastCheckin?.proteinPct), 0) / withCheckin.length)
      : 0;

  const avgHydration =
    withCheckin.length > 0
      ? Math.round(withCheckin.reduce((sum, r) => sum + pct(r?.lastCheckin?.hydrationPct), 0) / withCheckin.length)
      : 0;

  const weakest =
    withCheckin.length === 0
      ? null
      : [
          { key: "Calories", v: avgCalories },
          { key: "Protein", v: avgProtein },
          { key: "Hydration", v: avgHydration },
        ].sort((a, b) => a.v - b.v)[0];

  const buckets = {
    "0–49": 0,
    "50–69": 0,
    "70–84": 0,
    "85–100": 0,
    "No check-in": 0,
  };

  for (const r of list) {
    if (!r?.lastCheckin) {
      buckets["No check-in"]++;
      continue;
    }
    const a = pct(r?.adherenceAvg);
    if (a < 50) buckets["0–49"]++;
    else if (a < 70) buckets["50–69"]++;
    else if (a < 85) buckets["70–84"]++;
    else buckets["85–100"]++;
  }

  const atRisk = [...list]
    .filter((r) => r?.needsAction)
    .sort((a, b) => {
      const pa = Number(a?.priority ?? 9);
      const pb = Number(b?.priority ?? 9);
      if (pa !== pb) return pa - pb;

      const na = String(a?.athleteName || "").toLowerCase();
      const nb = String(b?.athleteName || "").toLowerCase();
      if (na < nb) return -1;
      if (na > nb) return 1;
      return 0;
    })
    .slice(0, 10);

  const recentCheckins = [...withCheckin]
    .sort((a, b) => {
      const ta = new Date(a?.lastCheckin?.createdAt || 0).getTime() || 0;
      const tb = new Date(b?.lastCheckin?.createdAt || 0).getTime() || 0;
      return tb - ta;
    })
    .slice(0, 8);

  return {
    total,
    withPlan,
    noPlan,
    missingCheckin,
    lowAdherence,
    needsAction,
    avgAdherence,
    avgCalories,
    avgProtein,
    avgHydration,
    weakest,
    buckets,
    atRisk,
    recentCheckins,
  };
}

function StatCard({ label, value, sub, tone = "base" }) {
  const toneCls =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50/60"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50/60"
      : tone === "bad"
      ? "border-red-200 bg-red-50/60"
      : "border-blue-100 bg-white";

  return (
    <div className={cx("rounded-2xl border p-4 shadow-sm", toneCls)}>
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-gray-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-gray-600">{sub}</p> : null}
    </div>
  );
}

function BucketBar({ label, value, total }) {
  const p = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-700 font-semibold">{label}</span>
        <span className="text-gray-600">
          {value} ({p}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
        <div className="h-full bg-[#46769B]" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function ReasonChip({ children }) {
  return (
    <span className="inline-flex px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-[11px] text-gray-700 font-semibold">
      {children}
    </span>
  );
}

export default function OverviewPanel({ loading, rows, meta, onOpenAthlete, onGoPlans }) {
  const o = useMemo(() => computeOverview(rows), [rows]);
  const weekLabel = meta?.weekStartISO ? `Week of ${meta.weekStartISO}` : "This week";

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500">Organization Nutrition</p>
          <h2 className="mt-1 text-xl font-extrabold text-gray-900">{weekLabel}</h2>
          <p className="mt-1 text-sm text-gray-600">
            Coach view: plan coverage, check-ins, and who needs attention first.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onGoPlans}
            className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#46769B]/35"
          >
            Create / Update Plans →
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Athletes" value={loading ? "—" : o.total} />
        <StatCard
          label="On an active plan"
          value={loading ? "—" : o.withPlan}
          sub={o.total ? `${Math.round((o.withPlan / o.total) * 100)}% coverage` : ""}
          tone={o.noPlan ? "warn" : "good"}
        />
        <StatCard label="Missing check-ins" value={loading ? "—" : o.missingCheckin} tone={o.missingCheckin ? "warn" : "good"} />
        <StatCard label="Low adherence" value={loading ? "—" : o.lowAdherence} tone={o.lowAdherence ? "warn" : "good"} />
        <StatCard label="Avg adherence" value={loading ? "—" : `${o.avgAdherence}%`} sub="Among athletes with a check-in" />
      </div>

      {/* Metric focus */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-extrabold text-gray-900">This week’s adherence by metric</p>
            <p className="text-xs text-gray-600 mt-1">
              Calories / Protein / Hydration averages from the latest check-ins.
            </p>
          </div>

          {o.weakest ? (
            <div className="text-xs font-semibold text-gray-700">
              Focus area: <span className="text-gray-900 font-extrabold">{o.weakest.key}</span>{" "}
              <span className="text-gray-600">({o.weakest.v}%)</span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <StatCard label="Calories" value={loading ? "—" : `${o.avgCalories}%`} />
          <StatCard label="Protein" value={loading ? "—" : `${o.avgProtein}%`} />
          <StatCard label="Hydration" value={loading ? "—" : `${o.avgHydration}%`} />
        </div>
      </div>

      {/* Distribution + lists */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Distribution */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-extrabold text-gray-900">Adherence distribution</p>
          <p className="text-xs text-gray-600 mt-1">Roster buckets based on the latest check-in.</p>

          <div className="mt-4 space-y-3">
            {Object.entries(o.buckets).map(([k, v]) => (
              <BucketBar key={k} label={k} value={v} total={o.total} />
            ))}
          </div>
        </div>

        {/* At risk */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold text-gray-900">At-risk athletes</p>
            <p className="text-xs text-gray-500">Top 10</p>
          </div>

          <div className="mt-3 divide-y divide-gray-100">
            {o.atRisk.map((r) => (
              <button
                key={r.athleteToken || r.athleteId || r.athleteEmail || r.athleteName}
                type="button"
                onClick={() => onOpenAthlete?.(r)}
                className="w-full text-left py-3 hover:bg-gray-50 rounded-xl px-2 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{r.athleteName}</p>
                    <p className="text-[11px] text-gray-500 truncate">{r.athleteEmail || "—"}</p>
                    {Array.isArray(r.reasons) && r.reasons.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {r.reasons.slice(0, 3).map((x) => (
                          <ReasonChip key={x}>{x}</ReasonChip>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <span className="shrink-0 inline-flex px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-[11px] text-gray-700 font-semibold">
                    {r.priorityLabel || "Flagged"}
                  </span>
                </div>
              </button>
            ))}

            {!loading && o.atRisk.length === 0 ? (
              <div className="py-6 text-sm text-gray-600">No at-risk athletes right now.</div>
            ) : null}
          </div>
        </div>

        {/* Recent check-ins */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold text-gray-900">Recent check-ins</p>
            <p className="text-xs text-gray-500">Latest</p>
          </div>

          <div className="mt-3 divide-y divide-gray-100">
            {o.recentCheckins.map((r) => (
              <button
                key={r.athleteToken || r.athleteId || r.athleteEmail || r.athleteName}
                type="button"
                onClick={() => onOpenAthlete?.(r)}
                className="w-full text-left py-3 hover:bg-gray-50 rounded-xl px-2 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{r.athleteName}</p>
                    <p className="text-[11px] text-gray-500">
                      {r.lastCheckin?.createdAt ? `Checked in: ${fmtDateShort(r.lastCheckin.createdAt)}` : "—"}
                    </p>

                    <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
                        <span className="text-gray-500">Cal</span>{" "}
                        <span className="font-semibold text-gray-900">{pct(r.lastCheckin?.caloriesPct)}%</span>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
                        <span className="text-gray-500">Pro</span>{" "}
                        <span className="font-semibold text-gray-900">{pct(r.lastCheckin?.proteinPct)}%</span>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
                        <span className="text-gray-500">Hyd</span>{" "}
                        <span className="font-semibold text-gray-900">{pct(r.lastCheckin?.hydrationPct)}%</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-sm font-extrabold text-gray-900">{pct(r.adherenceAvg)}%</span>
                </div>
              </button>
            ))}

            {!loading && o.recentCheckins.length === 0 ? (
              <div className="py-6 text-sm text-gray-600">No check-ins yet.</div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}