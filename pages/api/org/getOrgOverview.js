// pages/api/org/getOrgOverview.js
import { requireOrg } from "@/lib/requireOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sortByDateDesc(a, b) {
  const ad = safeDate(a?.createdAt)?.getTime?.() || 0;
  const bd = safeDate(b?.createdAt)?.getTime?.() || 0;
  return bd - ad;
}

function todayNY() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === "year")?.value;
  const m = parts.find(p => p.type === "month")?.value;
  const d = parts.find(p => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

const MEAL_KEYS = ["breakfast", "lunch", "afternoon", "dinner"];

function countChecked(comp) {
  let n = 0;
  for (const k of MEAL_KEYS) {
    if (comp?.[k]?.mealDone)      n++;
    if (comp?.[k]?.hydrationDone) n++;
  }
  return n;
}

function safeJsonParse(v) {
  if (!v) return {};
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return {}; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Route", "getOrgOverview");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = requireOrg(req);
  if (!auth?.ok) {
    return res.status(401).json({ error: auth?.error || "Unauthorized" });
  }

  const orgToken = String(auth?.org?.token || "").trim();
  if (!orgToken) {
    return res.status(401).json({ error: "Organization token missing from session. Please log out and back in." });
  }

  const daysStale    = Math.max(7,  Math.min(180, Number(req.query?.daysStale    || 30)));
  const activityLimit = Math.max(5, Math.min(50,  Number(req.query?.activityLimit || 10)));

  const emptyStats = {
    totalAthletes: 0, totalPlans: 0, athletesWithPlans: 0,
    coveragePct: 0, coveragePercent: 0, needsPlan: 0,
    activeLast30: 0, staleCount: 0,
    workoutsTodayPercent: 0, nutritionTodayPercent: 0,
    workoutsTodayCompleted: 0, workoutsTodayTotal: 0,
    nutritionTodayCompleted: 0, nutritionTodayTotal: 0,
  };

  try {
    // 1) Load all active athletes for org
    const { data: athletes } = await db
      .from("athletes")
      .select("id, athlete_token, name, email, created_at, status")
      .eq("org_token", orgToken)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(2000);

    if (!athletes?.length) {
      return res.status(200).json({ stats: emptyStats, athletes: [], recentActivity: [] });
    }

    const tokens = athletes.map(a => a.athlete_token).filter(Boolean);

    // 2) Nutrition plan coverage + activity feed (bulk query)
    const { data: planRows } = await db
      .from("nutrition_plans")
      .select("athlete_token, phase, prescription, status, created_at, created_by")
      .in("athlete_token", tokens)
      .order("created_at", { ascending: false });

    // Latest plan per athlete_token
    const planByToken = new Map();
    const activity    = [];
    for (const p of planRows ?? []) {
      if (!planByToken.has(p.athlete_token)) planByToken.set(p.athlete_token, p);
      activity.push({
        type:         "plan",
        athleteEmail: athletes.find(a => a.athlete_token === p.athlete_token)?.email || "",
        title:        p.prescription
          ? String(p.prescription).slice(0, 80)
          : (p.phase ? `Nutrition Plan • ${p.phase}` : "Nutrition Plan"),
        createdAt:    p.created_at,
        createdBy:    p.created_by || "",
      });
    }

    // 3) Per-athlete metrics
    const now     = new Date();
    const staleMs = daysStale * 24 * 60 * 60 * 1000;

    let totalPlans = 0, athletesWithPlans = 0, activeLast30 = 0, staleCount = 0, needsPlan = 0;

    const enrichedAthletes = athletes.map(a => {
      const plan    = planByToken.get(a.athlete_token) ?? null;
      const hasPlan = Boolean(plan);
      totalPlans    += plan ? 1 : 0;

      if (hasPlan) athletesWithPlans++;
      else needsPlan++;

      const lastDate   = safeDate(plan?.created_at);
      const isActive30 = lastDate && Math.abs(now.getTime() - lastDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
      if (isActive30) activeLast30++;

      const isStale = lastDate ? (now.getTime() - lastDate.getTime() > staleMs) : true;
      if (isStale) staleCount++;

      return {
        id:            a.id,
        name:          a.name  || "",
        email:         String(a.email || "").trim().toLowerCase(),
        createdAt:     a.created_at || "",
        status:        a.status || "active",
        tags:          [],
        plansCount:    hasPlan ? 1 : 0,
        lastPlanAt:    plan?.created_at || "",
        lastPlanTitle: plan?.prescription || (plan?.phase ? `Nutrition Plan • ${plan.phase}` : "") || "",
        needsPlan:     !hasPlan,
        stale:         isStale,
      };
    });

    const totalAthletes = enrichedAthletes.length;
    const coveragePct   = totalAthletes ? Math.round((athletesWithPlans / totalAthletes) * 100) : 0;

    activity.sort(sortByDateDesc);
    const recentActivity = activity.slice(0, activityLimit);

    // 4) Workouts today
    let workoutsTodayCompleted = 0;
    let workoutsTodayTotal     = 0;

    try {
      const today = todayNY();
      const { data: todayWorkouts } = await db
        .from("daily_workouts")
        .select("status")
        .eq("org_token", orgToken)
        .eq("date", today);

      workoutsTodayTotal     = (todayWorkouts || []).length;
      workoutsTodayCompleted = (todayWorkouts || []).filter(r => {
        const s = String(r.status || "").toLowerCase();
        return s === "completed" || s === "pending_review";
      }).length;
    } catch (wErr) {
      console.warn("[getOrgOverview] workouts today query failed:", wErr?.message);
    }

    // 5) Nutrition completions today
    let nutritionTodayCompleted = 0;
    let nutritionTodayTotal     = 0;

    if (tokens.length > 0) {
      try {
        const today = todayNY();

        const { data: todayNutrition } = await db
          .from("nutrition_completions")
          .select("athlete_token, completion_json")
          .in("athlete_token", tokens)
          .eq("date", today);

        const tokenSet = new Set(tokens);
        const byToken  = new Map();

        for (const r of todayNutrition ?? []) {
          const tok  = String(r.athlete_token || "").trim();
          if (!tok || !tokenSet.has(tok)) continue;
          const comp = safeJsonParse(r.completion_json);
          const existing = byToken.get(tok);
          if (!existing || countChecked(comp) > countChecked(existing)) {
            byToken.set(tok, comp);
          }
        }

        nutritionTodayTotal     = athletes.length * 8;
        nutritionTodayCompleted = 0;
        for (const comp of byToken.values()) {
          nutritionTodayCompleted += countChecked(comp);
        }
      } catch (nErr) {
        console.warn("[getOrgOverview] nutrition today query failed:", nErr?.message);
      }
    }

    const workoutsTodayPercent  = workoutsTodayTotal  > 0
      ? Math.round((workoutsTodayCompleted  / workoutsTodayTotal)  * 100) : 0;
    const nutritionTodayPercent = nutritionTodayTotal > 0
      ? Math.round((nutritionTodayCompleted / nutritionTodayTotal) * 100) : 0;

    return res.status(200).json({
      stats: {
        totalAthletes,
        totalPlans,
        athletesWithPlans,
        coveragePct,
        coveragePercent: coveragePct,
        needsPlan,
        activeLast30,
        staleCount,
        workoutsTodayPercent,
        nutritionTodayPercent,
        workoutsTodayCompleted,
        workoutsTodayTotal,
        nutritionTodayCompleted,
        nutritionTodayTotal,
      },
      athletes:       enrichedAthletes,
      recentActivity,
    });

  } catch (err) {
    console.error("[getOrgOverview] error:", err);
    return res.status(500).json({ error: "Failed to build org overview", detail: err?.message });
  }
}
