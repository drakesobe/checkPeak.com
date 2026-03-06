// components/org/dashboard/DashboardStatsGrid.jsx
"use client";

import { useMemo } from "react";
import { Users, ShieldCheck, Activity, Utensils } from "lucide-react";
import { DS, StatCard } from "@/components/org/dashboard/DashboardUI";

function pct(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function DashboardStatsGrid({ stats }) {
  const model = useMemo(() => {
    const totalAthletes        = num(stats?.totalAthletes);
    const coverage             = pct(stats?.coveragePercent ?? stats?.coveragePct ?? 0);
    const needsPlan            = num(stats?.needsPlan);
    const workoutsTodayPct     = pct(stats?.workoutsTodayPercent ?? 0);
    const workoutsCompleted    = num(stats?.workoutsTodayCompleted);
    const workoutsTotal        = num(stats?.workoutsTodayTotal);
    const nutritionTodayPct    = pct(stats?.nutritionTodayPercent ?? 0);
    const nutritionCompleted   = num(stats?.nutritionTodayCompleted);
    const nutritionTotal       = num(stats?.nutritionTodayTotal);

    return {
      totalAthletes,
      coverage,
      coverageSub:  needsPlan > 0 ? `${needsPlan} need plans` : "All covered",
      workoutsTodayPct,
      workoutsSub:  workoutsTotal > 0 ? `${workoutsCompleted}/${workoutsTotal} done` : "Live",
      nutritionTodayPct,
      nutritionSub: nutritionTotal > 0 ? `${nutritionCompleted}/${nutritionTotal} done` : "Live",
    };
  }, [stats]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ backgroundColor: DS.border }}>
      <StatCard
        icon={Users}
        label="Athletes"
        value={model.totalAthletes}
        sub={`Total roster`}
        href="/org/athletes"
      />
      <StatCard
        icon={ShieldCheck}
        label="Coverage"
        value={`${model.coverage}%`}
        sub={model.coverageSub}
        href="/org/prescriptions"
      />
      <StatCard
        icon={Activity}
        label="Workouts Today"
        value={`${model.workoutsTodayPct}%`}
        sub={model.workoutsSub}
        href="/org/workouts-calendar"
      />
      <StatCard
        icon={Utensils}
        label="Nutrition Today"
        value={`${model.nutritionTodayPct}%`}
        sub={model.nutritionSub}
        href="/org/nutrition"
      />
    </div>
  );
}