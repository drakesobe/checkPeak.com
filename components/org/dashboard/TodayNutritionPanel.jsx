// components/org/dashboard/TodayNutritionPanel.jsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Droplets,
  Utensils,
  RefreshCcw,
  ArrowRight,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

import { Button, Pill } from "@/components/org/dashboard/DashboardUI";
import { safeJson } from "@/lib/org/dashboard-utils";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function pct(n, d) {
  const nn = Number(n || 0);
  const dd = Number(d || 0);
  if (!dd) return 0;
  return Math.round((nn / dd) * 100);
}

export default function TodayNutritionPanel({
  onGoNutrition, // () => void
  onBuildNutritionPlan, // (athleteToken) => void
  onViewAthleteNutrition, // (athleteToken) => void
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [summary, setSummary] = useState(null);
  const [needsList, setNeedsList] = useState([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const res = await fetch("/api/org/nutrition/todaySummary", {
        method: "GET",
        credentials: "include",
      });

      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || "Failed to load nutrition summary.");

      setSummary(json?.summary || null);
      setNeedsList(Array.isArray(json?.needsList) ? json.needsList : []);
    } catch (e) {
      setErr(e?.message || "Failed to load nutrition summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* ---------------- derived numbers ---------------- */

  const total = Number(summary?.totalAthletes || 0);
  const withPlan = Number(summary?.withPlan || 0);
  const missingPlan = Number(summary?.missingPlan || 0);
  const hydrationSetCount = Number(summary?.hydrationSetCount || 0);

  const coveragePct = useMemo(() => pct(withPlan, total), [withPlan, total]);
  const hydrationPct = useMemo(() => pct(hydrationSetCount, withPlan), [hydrationSetCount, withPlan]);

  const headerTone = missingPlan > 0 ? "warn" : "good";

  /* ---------------- list behavior (max 4) ---------------- */

  const MAX_PREVIEW = 4;
  const preview = useMemo(
    () => (Array.isArray(needsList) ? needsList.slice(0, MAX_PREVIEW) : []),
    [needsList]
  );
  const remaining = Math.max(0, (needsList?.length || 0) - MAX_PREVIEW);

  const goMore = useCallback(() => {
    onGoNutrition?.();
  }, [onGoNutrition]);

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-4 sm:p-6">
      {/* Header row */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Utensils className="w-5 h-5 text-[#46769B] shrink-0" />
            <h2 className="text-lg font-extrabold text-gray-900 truncate">Today • Nutrition</h2>
          </div>

          <p className="text-sm text-gray-600 mt-1">
            Coverage + hydration setup. Plan gaps show below (max {MAX_PREVIEW}).
          </p>

          {/* Topline pills (replaces stats grid) */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone={headerTone}>
              {missingPlan > 0 ? <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> : null}
              {loading ? "Loading…" : missingPlan > 0 ? `${missingPlan} need a plan` : "All covered"}
            </Pill>

            <Pill>
              Coverage: {loading ? "…" : `${coveragePct}%`}{" "}
              <span className="text-gray-500">({withPlan}/{total || 0})</span>
            </Pill>

            <Pill>
              <Droplets className="w-3.5 h-3.5 mr-1.5" />
              Hydration set: {loading ? "…" : `${hydrationPct}%`}
              <span className="text-gray-500"> ({hydrationSetCount}/{withPlan || 0})</span>
            </Pill>
          </div>
        </div>

        {/* Actions (full width on mobile) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:flex lg:justify-end">
          <Button
            variant="secondary"
            className="w-full px-3 py-2 text-xs"
            onClick={refresh}
            disabled={loading}
            title="Refresh nutrition summary"
          >
            <RefreshCcw className={cx("w-4 h-4", loading ? "animate-spin" : "")} />
            Refresh
          </Button>

          {onGoNutrition ? (
            <Button
              variant="secondary"
              className="w-full px-3 py-2 text-xs"
              onClick={onGoNutrition}
              title="Open Nutrition"
            >
              Open
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Loading / error */}
      {loading ? (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">Loading nutrition…</p>
          <p className="text-[11px] text-gray-500 mt-1">Pulling plan coverage + hydration targets.</p>
        </div>
      ) : null}

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{err}</p>
          <p className="text-[11px] text-red-600 mt-1">
            If this persists, confirm /api/org/nutrition/todaySummary and env vars.
          </p>
        </div>
      ) : null}

      {/* Needs list (always visible, max 4) */}
      {!loading && !err ? (
        <div className="mt-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm font-extrabold text-gray-900">
              Needs a Nutrition Plan{" "}
              <span className="text-gray-500 font-semibold">({needsList.length})</span>
            </p>

            {onGoNutrition && remaining > 0 ? (
              <Button
                variant="secondary"
                className="w-full sm:w-auto px-3 py-2 text-xs"
                onClick={goMore}
                title="Open Nutrition to view the full list"
              >
                More ({remaining})
                <ExternalLink className="w-4 h-4" />
              </Button>
            ) : null}
          </div>

          {needsList.length === 0 ? (
            <div className="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">Nice — everyone has an active plan.</p>
              <p className="text-[11px] text-emerald-800 mt-1">Open Nutrition for check-ins + compliance.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {preview.map((a) => (
                <div
                  key={a.token || a.email}
                  className="rounded-2xl border border-gray-200 bg-white p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-gray-900 truncate">{a.name || "Athlete"}</p>
                    <p className="text-[12px] text-gray-600 break-all">{a.email || a.token || ""}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:flex gap-2">
                    {onViewAthleteNutrition ? (
                      <Button
                        variant="secondary"
                        className="w-full sm:w-auto px-3 py-2 text-xs"
                        onClick={() => onViewAthleteNutrition(a.token)}
                      >
                        View
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    ) : null}

                    {onBuildNutritionPlan ? (
                      <Button
                        variant="dark"
                        className="w-full sm:w-auto px-3 py-2 text-xs"
                        onClick={() => onBuildNutritionPlan(a.token)}
                      >
                        Build
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}

              {remaining > 0 ? (
                <p className="text-[11px] text-gray-500">
                  Showing {MAX_PREVIEW}. Use <span className="font-semibold">More</span> for the full list.
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
