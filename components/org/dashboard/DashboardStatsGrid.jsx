// components/org/dashboard/DashboardStatsGrid.jsx
"use client";

import { useMemo } from "react";
import { Users, ShieldCheck, Activity, Utensils, ArrowRight } from "lucide-react";
import { DS, StatCard } from "@/components/org/dashboard/DashboardUI";

function pct(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Derive the single most important action the coach should take right now.
 * Returns { text, href, tone } or null if everything looks healthy.
 */
function deriveUrgency({ needsPlan, coveragePct, workoutsTodayPct, nutritionTodayPct, totalAthletes }) {
  if (needsPlan > 0) return {
    text:  `${needsPlan} athlete${needsPlan > 1 ? "s" : ""} still need a plan — start there.`,
    href:  "/org/prescriptions",
    tone:  "bad",
  };
  if (coveragePct < 80) return {
    text:  `Coverage is at ${coveragePct}% — assign plans to close the gap.`,
    href:  "/org/prescriptions",
    tone:  "warn",
  };
  if (workoutsTodayPct < 50 && totalAthletes > 0) return {
    text:  `Workout completion is only ${workoutsTodayPct}% today — check who's behind.`,
    href:  "/org/workouts-calendar",
    tone:  "warn",
  };
  if (nutritionTodayPct < 50 && totalAthletes > 0) return {
    text:  `Nutrition check-ins are at ${nutritionTodayPct}% — open nutrition queue.`,
    href:  "/org/nutrition",
    tone:  "warn",
  };
  if (totalAthletes === 0) return null;
  return {
    text:  "Your roster is covered and on track — nothing urgent today.",
    href:  null,
    tone:  "good",
  };
}

export default function DashboardStatsGrid({ stats }) {
  const model = useMemo(() => {
    const totalAthletes      = num(stats?.totalAthletes);
    const coveragePct        = pct(stats?.coveragePercent ?? stats?.coveragePct ?? 0);
    const needsPlan          = num(stats?.needsPlan);
    const workoutsTodayPct   = pct(stats?.workoutsTodayPercent ?? 0);
    const workoutsCompleted  = num(stats?.workoutsTodayCompleted);
    const workoutsTotal      = num(stats?.workoutsTodayTotal);
    const nutritionTodayPct  = pct(stats?.nutritionTodayPercent ?? 0);
    const nutritionCompleted = num(stats?.nutritionTodayCompleted);
    const nutritionTotal     = num(stats?.nutritionTodayTotal);

    const urgency = deriveUrgency({ needsPlan, coveragePct, workoutsTodayPct, nutritionTodayPct, totalAthletes });

    return {
      totalAthletes,
      coveragePct,
      needsPlan,
      workoutsTodayPct,
      workoutsSub:     workoutsTotal > 0 ? `${workoutsCompleted}/${workoutsTotal} done` : "Live",
      nutritionTodayPct,
      nutritionSub:    nutritionTotal > 0 ? `${nutritionCompleted}/${nutritionTotal} done` : "Live",
      urgency,
    };
  }, [stats]);

  const urgencyColors = {
    bad:  { bg: DS.bannedBg,  border: DS.bannedBorder,  text: DS.banned,  icon: "🔴" },
    warn: { bg: DS.cautionBg, border: DS.cautionBorder, text: DS.caution, icon: "🟡" },
    good: { bg: DS.safeBg,    border: DS.safeBorder,    text: DS.safe,    icon: "🟢" },
  };

  const uc = model.urgency ? (urgencyColors[model.urgency.tone] || urgencyColors.good) : null;

  return (
    <div className="space-y-3">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ backgroundColor: DS.border }}>
        <StatCard
          icon={Users}
          label="Athletes"
          value={model.totalAthletes}
          sub="Total roster"
          href="/org/athletes"
        />
        <StatCard
          icon={ShieldCheck}
          label="Coverage"
          value={`${model.coveragePct}%`}
          sub={model.needsPlan > 0 ? `${model.needsPlan} need plans` : "All covered"}
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

      {/* Urgency directive */}
      {model.urgency && uc && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{
            backgroundColor: uc.bg,
            border:          `1px solid ${uc.border}`,
            borderLeft:      `3px solid ${uc.text}`,
          }}
        >
          <p className="text-xs font-bold" style={{ color: uc.text }}>
            {model.urgency.text}
          </p>
          {model.urgency.href && (
            <a
              href={model.urgency.href}
              className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wide shrink-0 hover:underline"
              style={{ color: uc.text }}
            >
              Go <ArrowRight className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}