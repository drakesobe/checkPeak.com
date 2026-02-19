// components/org/dashboard/DashboardStatsGrid.jsx
"use client";

import { useMemo, useState } from "react";
import {
  Users,
  ShieldCheck,
  Activity,
  Utensils,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { StatCard } from "@/components/org/dashboard/DashboardUI";

function pct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function plural(n, s) {
  return n === 1 ? s : `${s}s`;
}

function explainSub(detail, hint) {
  return [detail, hint].filter(Boolean).join(" • ");
}

export default function DashboardStatsGrid({
  stats,
  helpDefaultOpen = false,
  helpStorageKey = "orgdash_stats_help_open",
}) {
  const model = useMemo(() => {
    const totalAthletes = num(stats?.totalAthletes);

    const coverage = pct(stats?.coveragePercent ?? stats?.coveragePct ?? 0);
    const needsPlan = num(stats?.needsPlan);

    const workoutsTodayPercent = pct(stats?.workoutsTodayPercent ?? 0);
    const workoutsTodayCompleted = num(stats?.workoutsTodayCompleted);
    const workoutsTodayTotal = num(stats?.workoutsTodayTotal);

    const nutritionTodayPercent = pct(stats?.nutritionTodayPercent ?? 0);
    const nutritionTodayCompleted = num(stats?.nutritionTodayCompleted);
    const nutritionTodayTotal = num(stats?.nutritionTodayTotal);

    const coverageHint =
      needsPlan > 0 ? `${needsPlan} ${plural(needsPlan, "athlete")} need plans` : "All covered";

    const workoutsHint =
      workoutsTodayTotal > 0 ? `${workoutsTodayCompleted}/${workoutsTodayTotal} done` : "Live";

    const nutritionHint =
      nutritionTodayTotal > 0 ? `${nutritionTodayCompleted}/${nutritionTodayTotal} done` : "Live";

    return {
      totalAthletes,
      coverage,
      coverageHint,
      workoutsTodayPercent,
      workoutsHint,
      nutritionTodayPercent,
      nutritionHint,
    };
  }, [stats]);

  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return Boolean(helpDefaultOpen);
    try {
      const v = localStorage.getItem(helpStorageKey);
      if (v == null) return Boolean(helpDefaultOpen);
      return String(v) === "true";
    } catch {
      return Boolean(helpDefaultOpen);
    }
  });

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        if (typeof window !== "undefined") localStorage.setItem(helpStorageKey, next ? "true" : "false");
      } catch {}
      return next;
    });
  };

  const Icon = open ? ChevronUp : ChevronDown;

  return (
    <div className="space-y-4">
      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Athletes"
          value={model.totalAthletes}
          sub={explainSub("Full roster size", "Tap to view")}
          href="/org/athletes"
        />

        <StatCard
          icon={ShieldCheck}
          label="Coverage"
          value={`${model.coverage}%`}
          sub={explainSub("Plans assigned", model.coverageHint)}
          href="/org/prescriptions"
        />

        <StatCard
          icon={Activity}
          label="Workouts Today"
          value={`${model.workoutsTodayPercent}%`}
          sub={explainSub("Completed today", model.workoutsHint)}
          href="/org/workouts-calendar"
        />

        <StatCard
          icon={Utensils}
          label="Nutrition Today"
          value={`${model.nutritionTodayPercent}%`}
          sub={explainSub("Completed today", model.nutritionHint)}
          href="/org/nutrition"
        />
      </div>

      {/* Better-looking tiny expandable tooltip */}
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white overflow-hidden">
        <button
          type="button"
          onClick={toggle}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50/80 transition"
          aria-expanded={open}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-2xl border border-gray-200 bg-white shadow-sm">
              <Info className="w-4 h-4 text-gray-600" />
            </span>

            <div className="min-w-0">
              <p className="text-sm font-extrabold text-gray-900 truncate">What do these numbers mean?</p>
              <p className="text-[12px] text-gray-600 truncate">
                Quick definitions for Coverage + Today %
              </p>
            </div>
          </div>

          <span className="shrink-0 inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 shadow-sm">
            <Icon className="w-4 h-4" />
          </span>
        </button>

        {open ? (
          <div className="px-4 pb-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="space-y-2">
                <p className="text-[12px] text-gray-700 leading-relaxed">
                  <span className="font-semibold text-gray-900">Coverage</span> = “Are athletes set up?” If it’s below 100%,
                  some athletes are missing required plans.
                </p>
                <p className="text-[12px] text-gray-700 leading-relaxed">
                  <span className="font-semibold text-gray-900">Today %</span> = Daily completion percentage. It updates live
                  as athletes submit workouts and nutrition.
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Tip: Check Coverage first, then Today %, then scroll down to take action. This page may need to be refreshed to update percentages.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
