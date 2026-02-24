// components/org/nutrition/nutritionTable/normalize.js

import { asNumber, clampPct, safeText } from "./helpers";

export function normalizeRow(input) {
  const r = input && typeof input === "object" ? input : {};

  const athleteToken = safeText(r.athleteToken || r.AthleteToken || r.token);
  const athleteName = safeText(r.athleteName || r.name || r.athlete?.name || r.AthleteName);
  const athleteEmail = safeText(r.athleteEmail || r.email || r.athlete?.email || r.AthleteEmail);

  const team = safeText(r.team || r.Team);
  const sport = safeText(r.sport || r.Sport);
  const position = safeText(r.position || r.Position);
  const year = safeText(r.year || r.Year);
  const orgName = safeText(r.orgName || r.organizationName || r.OrganizationName);

  const rawPlan = r.plan || r.planDetails || r.latestPlan || null;
  const plan = rawPlan
    ? {
        phase: safeText(rawPlan.phase || rawPlan.Phase),
        status: safeText(rawPlan.status || rawPlan.Status || "active"),
        effectiveDate: safeText(
          rawPlan.effectiveDate || rawPlan.EffectiveDate || rawPlan?.planJson?.meta?.effectiveDate
        ),
        daily: rawPlan.daily || rawPlan.Daily || rawPlan?.planJson?.daily || {
          calories: safeText(rawPlan.dailyCalories || rawPlan.DailyCalories),
          protein: safeText(rawPlan.dailyProtein || rawPlan.DailyProtein),
          carbs: safeText(rawPlan.dailyCarbs || rawPlan.DailyCarbs),
          fat: safeText(rawPlan.dailyFat || rawPlan.DailyFat),
          hydrationOz: safeText(rawPlan.dailyHydration || rawPlan.HydrationOz || rawPlan.hydrationOz),
        },
        createdAt: safeText(rawPlan.createdAt || rawPlan.CreatedAt),
        createdBy: safeText(rawPlan.createdBy || rawPlan.CreatedBy),
      }
    : null;

  const rawCompletion = r.completion || r.lastCompletion || r.lastCheckin || null;
  const completion = rawCompletion
    ? {
        updatedAt: safeText(
          rawCompletion.updatedAt ||
            rawCompletion.createdAt ||
            rawCompletion.UpdatedAt ||
            rawCompletion.CreatedAt
        ),
        dateISO: safeText(rawCompletion.dateISO || rawCompletion.DateISO || rawCompletion._dateISO || ""),
        weekStartISO: safeText(rawCompletion.weekStartISO || rawCompletion.WeekStartISO || ""),
        totalPct: asNumber(
          rawCompletion.totalPct ?? rawCompletion._totalPct ?? rawCompletion.adherenceAvg ?? rawCompletion.avgPct
        ),
        mealPct: asNumber(rawCompletion.mealPct),
        hydrationPct: asNumber(rawCompletion.hydrationPct),
        caloriesPct: asNumber(rawCompletion.caloriesPct),
        proteinPct: asNumber(rawCompletion.proteinPct),
        carbsPct: asNumber(rawCompletion.carbsPct),
        hydrationPct: asNumber(rawCompletion.hydrationPct),
        notes: safeText(rawCompletion.notes),
      }
    : null;

  const rollup = {
    last7Avg: asNumber(r.rollup?.last7Avg ?? r.last7Avg),
    last14Avg: asNumber(r.rollup?.last14Avg ?? r.last14Avg),
    streakDays: asNumber(r.rollup?.streakDays ?? r.streakDays),
    missedThisWeek: Boolean(r.rollup?.missedThisWeek ?? r.missedThisWeek),
  };

  let adherenceAvg =
    clampPct(completion?.totalPct) ??
    clampPct(rollup.last7Avg) ??
    (() => {
      const parts = [completion?.caloriesPct, completion?.proteinPct, completion?.carbsPct, completion?.hydrationPct]
        .map(clampPct)
        .filter((x) => x != null);
      if (!parts.length) return null;
      return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
    })();

  if (adherenceAvg == null && completion) {
    const m = clampPct(completion.mealPct);
    const h = clampPct(completion.hydrationPct);
    if (m != null && h != null) adherenceAvg = Math.round((m + h) / 2);
  }

  return {
    ...r,
    athleteToken,
    athleteName: athleteName || "Athlete",
    athleteEmail,
    team,
    sport,
    position,
    year,
    orgName,
    plan,
    completion,
    rollup,
    adherenceAvg,
  };
}

export function sortRowsDefault(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return [...list].sort((a, b) => {
    const at = a?.completion?.updatedAt ? new Date(a.completion.updatedAt).getTime() : 0;
    const bt = b?.completion?.updatedAt ? new Date(b.completion.updatedAt).getTime() : 0;
    if (bt !== at) return bt - at;
    return String(a?.athleteName || "").localeCompare(String(b?.athleteName || ""));
  });
}