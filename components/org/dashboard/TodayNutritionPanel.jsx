// components/org/dashboard/TodayNutritionPanel.jsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Droplets, Utensils, RefreshCcw, ArrowRight, AlertTriangle, ExternalLink, CheckCircle2 } from "lucide-react";
import { DS, Button } from "@/components/org/dashboard/DashboardUI";
import { safeJson } from "@/lib/org/dashboard-utils";

function pct(n, d) {
  const nn = Number(n || 0); const dd = Number(d || 0);
  if (!dd) return 0;
  return Math.round((nn / dd) * 100);
}

export default function TodayNutritionPanel({ onGoNutrition, onBuildNutritionPlan, onViewAthleteNutrition }) {
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState("");
  const [summary,   setSummary]   = useState(null);
  const [needsList, setNeedsList] = useState([]);

  const refresh = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/org/nutrition/todaySummary", { credentials: "include" });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || "Failed to load nutrition summary.");
      setSummary(json?.summary || null);
      setNeedsList(Array.isArray(json?.needsList) ? json.needsList : []);
    } catch (e) {
      setErr(e?.message || "Failed to load nutrition summary.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const total             = Number(summary?.totalAthletes    || 0);
  const withPlan          = Number(summary?.withPlan         || 0);
  const missingPlan       = Number(summary?.missingPlan      || 0);
  const hydrationSetCount = Number(summary?.hydrationSetCount || 0);

  const coveragePct  = useMemo(() => pct(withPlan, total),            [withPlan, total]);
  const hydrationPct = useMemo(() => pct(hydrationSetCount, total), [hydrationSetCount, total]);

  const MAX_PREVIEW = 1;
  const preview   = useMemo(() => needsList.slice(0, MAX_PREVIEW), [needsList]);
  const remaining = Math.max(0, needsList.length - MAX_PREVIEW);

  const allGood = !loading && !err && missingPlan === 0 && total > 0;

  return (
    <section style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}` }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${DS.border}` }}>
        <div className="flex items-center gap-2">
          <Utensils className="w-4 h-4 shrink-0" style={{ color: DS.brand }} />
          <span className="text-xs font-black uppercase tracking-wider" style={{ color: DS.brand }}>Nutrition</span>
          {!loading && !err && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-bold"
              style={{
                backgroundColor: missingPlan > 0 ? DS.cautionBg : DS.safeBg,
                color:           missingPlan > 0 ? DS.caution   : DS.safe,
                border:          `1px solid ${missingPlan > 0 ? DS.cautionBorder : DS.safeBorder}`,
              }}
            >
              {missingPlan > 0
                ? <><AlertTriangle className="w-3 h-3" /> {missingPlan} need plans</>
                : <><CheckCircle2  className="w-3 h-3" /> All covered</>
              }
            </span>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          {onGoNutrition && (
            <Button variant="secondary" onClick={onGoNutrition}>
              Open <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Metric tiles */}
        <div className="grid grid-cols-2 gap-px" style={{ backgroundColor: DS.border }}>
          <div className="p-3" style={{ backgroundColor: DS.pageBg }}>
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.dimText }}>Coverage</p>
            <p className="text-2xl font-black mt-1 tabular-nums" style={{ color: DS.bodyText, fontFamily: "'Barlow Condensed', sans-serif" }}>
              {loading ? "…" : `${coveragePct}%`}
            </p>
            <p className="text-xs mt-1" style={{ color: DS.dimText }}>{withPlan}/{total} athletes</p>
          </div>
          <div className="p-3" style={{ backgroundColor: DS.pageBg }}>
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.dimText }}>
              <Droplets className="w-3 h-3 inline mr-1" style={{ color: DS.brand }} />
              Hydration Set
            </p>
            <p className="text-2xl font-black mt-1 tabular-nums" style={{ color: DS.bodyText, fontFamily: "'Barlow Condensed', sans-serif" }}>
              {loading ? "…" : `${hydrationPct}%`}
            </p>
            <p className="text-xs mt-1" style={{ color: DS.dimText }}>{hydrationSetCount}/{total} athletes</p>
          </div>
        </div>

        {/* States */}
        {loading && (
          <div className="mt-3 p-3 text-xs" style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText }}>
            Loading nutrition summary…
          </div>
        )}

        {err && (
          <div className="mt-3 p-3 text-xs font-bold" style={{ backgroundColor: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, color: DS.banned }}>
            {err}
          </div>
        )}

        {/* All good state */}
        {allGood && (
          <div
            className="mt-3 flex items-center gap-2 px-3 py-3"
            style={{ backgroundColor: DS.safeBg, border: `1px solid ${DS.safeBorder}`, borderLeft: `3px solid ${DS.safe}` }}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: DS.safe }} />
            <div>
              <p className="text-xs font-black" style={{ color: DS.safe }}>Everyone has an active plan.</p>
              <p className="text-xs mt-0.5" style={{ color: DS.safe, opacity: 0.8 }}>
                Open Nutrition to review check-ins and compliance.
              </p>
            </div>
          </div>
        )}

        {/* Needs list */}
        {!loading && !err && needsList.length > 0 && (
          <div className="mt-3">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>
                Needs a Plan
                <span
                  className="ml-1.5 px-1.5 py-0.5 font-bold normal-case"
                  style={{
                    background: DS.cautionBg,
                    border: `1px solid ${DS.cautionBorder}`,
                    color: DS.caution,
                    fontSize: 10,
                  }}
                >
                  {needsList.length}
                </span>
              </p>
            </div>

            {/* Scrollable athlete rows */}
            <div
              className="space-y-1"
              style={{
                maxHeight: 280,
                overflowY: needsList.length > 4 ? "auto" : "visible",
              }}
            >
              {preview.map((a) => (
                <div
                  key={a.token || a.email}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                  style={{
                    border:     `1px solid ${DS.border}`,
                    borderLeft: `3px solid ${DS.caution}`,
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: DS.bodyText }}>
                      {a.name || "Athlete"}
                    </p>
                    <p className="text-xs truncate" style={{ color: DS.dimText }}>
                      {a.email || a.token || ""}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {onViewAthleteNutrition && (
                      <Button variant="secondary" onClick={() => onViewAthleteNutrition(a.token)}>
                        View <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                    {onBuildNutritionPlan && (
                      <Button onClick={() => onBuildNutritionPlan(a.token)}>
                        Build <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Overflow CTA */}
            {remaining > 0 && onGoNutrition && (
              <button
                type="button"
                onClick={onGoNutrition}
                className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-all"
                style={{
                  background: DS.cautionBg,
                  border:     `1px solid ${DS.cautionBorder}`,
                  color:      DS.caution,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#fff0d0"; }}
                onMouseLeave={e => { e.currentTarget.style.background = DS.cautionBg; }}
              >
                <ExternalLink className="w-3 h-3" />
                View all {needsList.length} athletes without a plan
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}