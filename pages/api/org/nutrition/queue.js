// pages/api/org/nutrition/queue.js
// GET — weekly adherence queue for all org athletes.

import { requireOrg } from "@/lib/requireOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

// Meal start times in minutes-since-midnight
const MEAL_MINUTES = { breakfast: 7 * 60, lunch: 12 * 60, afternoon: 15 * 60, dinner: 18 * 60 + 30 };
const MEALS        = ["breakfast", "lunch", "afternoon", "dinner"];

function weeklyExpectedChecks(now = new Date()) {
  const dayOfWeek  = now.getDay(); // 0=Sun…6=Sat
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let expected     = dayOfWeek * 8;
  for (const mins of Object.values(MEAL_MINUTES)) {
    if (nowMinutes >= mins) expected += 2;
  }
  return expected;
}

function countChecksInJson(json) {
  if (!json || typeof json !== "object") return 0;
  let checked = 0;
  for (const meal of MEALS) {
    if (json[meal]?.mealDone)      checked++;
    if (json[meal]?.hydrationDone) checked++;
  }
  return checked;
}

function getWeekStartISO() {
  const now   = new Date();
  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - now.getUTCDay());
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString().slice(0, 10);
}

function safeJsonParse(v) {
  if (!v) return null;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return null; }
}

function asStr(v) { return String(v ?? "").trim(); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const orgToken = asStr(auth?.org?.token);
  if (!orgToken) return res.status(401).json({ error: "Org token missing from session." });

  const now            = new Date();
  const weekStart      = getWeekStartISO();
  const weeklyExpected = weeklyExpectedChecks(now);

  try {
    // 1) Fetch athletes — try with reminder columns; fall back to minimal if they don't exist yet
    let athletes = null;
    let hasReminderCols = false;

    const { data: fullData, error: fullErr } = await db
      .from("athletes")
      .select("id, athlete_token, name, email, sport, status, last_reminder_sent_at, reminder_count")
      .eq("org_token", orgToken)
      .or("status.eq.active,status.is.null")
      .limit(2000);

    if (!fullErr) {
      athletes = fullData;
      hasReminderCols = true;
    } else {
      const { data: minData, error: minErr } = await db
        .from("athletes")
        .select("id, athlete_token, name, email, sport, status")
        .eq("org_token", orgToken)
        .or("status.eq.active,status.is.null")
        .limit(2000);
      if (minErr) throw minErr;
      athletes = minData;
    }

    if (!athletes?.length) {
      return res.status(200).json({
        rows:   [],
        meta:   { weekStartISO: weekStart, weeklyExpected, sports: [], teams: [] },
        counts: { total: 0, withPlan: 0, missingPlan: 0, noCheckin: 0, lowAdherence: 0, onTrack: 0 },
      });
    }

    const tokens = athletes.map(a => a.athlete_token).filter(Boolean);

    // 2) Fetch active plans + this week's completions in parallel
    const [plansResult, completionsResult] = await Promise.all([
      db.from("nutrition_plans")
        .select("athlete_token, status, phase, daily_calories, daily_protein, daily_carbs, daily_fat, created_at")
        .in("athlete_token", tokens)
        .eq("status", "active")
        .order("created_at", { ascending: false }),

      db.from("nutrition_completions")
        .select("athlete_token, date, completion_json")
        .in("athlete_token", tokens)
        .gte("date", weekStart)
        .order("date", { ascending: false }),
    ]);

    // Latest active plan per token
    const planByToken = new Map();
    for (const p of plansResult.data ?? []) {
      if (!planByToken.has(p.athlete_token)) planByToken.set(p.athlete_token, p);
    }

    // Accumulate weekly checks per token
    const completionByToken = new Map();
    for (const c of completionsResult.data ?? []) {
      const tok  = c.athlete_token;
      const json = safeJsonParse(c.completion_json);
      const dateISO = c.date ? String(c.date).slice(0, 10) : "";

      if (!completionByToken.has(tok)) {
        completionByToken.set(tok, { totalChecked: 0, hasAnyRecord: false, mostRecentDate: "" });
      }
      const entry = completionByToken.get(tok);
      entry.totalChecked += countChecksInJson(json);
      entry.hasAnyRecord  = true;
      if (!entry.mostRecentDate || dateISO > entry.mostRecentDate) entry.mostRecentDate = dateISO;
    }

    // 3) Build rows
    const sports = new Set();
    const rows   = athletes.map(ath => {
      const token      = ath.athlete_token;
      const plan       = planByToken.get(token) ?? null;
      const completion = completionByToken.get(token) ?? null;
      if (ath.sport) sports.add(ath.sport);

      const hasPlan        = Boolean(plan);
      const missingCheckin = hasPlan && !completion?.hasAnyRecord;

      let adherenceAvg         = null;
      let weeklyChecksLogged   = null;
      let weeklyChecksExpected = null;

      if (completion?.hasAnyRecord) {
        weeklyChecksLogged   = completion.totalChecked;
        weeklyChecksExpected = weeklyExpected;
        adherenceAvg = weeklyExpected > 0
          ? Math.min(100, Math.round((weeklyChecksLogged / weeklyExpected) * 100))
          : 100;
      }

      return {
        athleteToken:         token || "",
        athleteName:          ath.name  || "Athlete",
        sport:                ath.sport || "",
        hasPlan,
        missingCheckin,
        adherenceAvg,
        weeklyChecksLogged,
        weeklyChecksExpected,
        plan: plan ? {
          calories: Number(plan.daily_calories || 0),
          protein:  Number(plan.daily_protein  || 0),
          carbs:    Number(plan.daily_carbs    || 0),
          fat:      Number(plan.daily_fat      || 0),
          phase:    asStr(plan.phase),
          status:   "active",
        } : null,
        lastReminderSentAt: hasReminderCols ? (ath.last_reminder_sent_at || null) : null,
        reminderCount:      hasReminderCols ? Number(ath.reminder_count || 0) : 0,
        lastSeen:           completion?.mostRecentDate || null,
      };
    });

    const total        = rows.length;
    const withPlan     = rows.filter(r => r.hasPlan).length;
    const missingPlan  = rows.filter(r => !r.hasPlan).length;
    const noCheckin    = rows.filter(r => r.hasPlan && r.missingCheckin).length;
    const lowAdherence = rows.filter(r => r.adherenceAvg != null && r.adherenceAvg < 65).length;
    const onTrack      = rows.filter(r => r.hasPlan && !r.missingCheckin && (r.adherenceAvg == null || r.adherenceAvg >= 65)).length;

    return res.status(200).json({
      rows,
      meta:   { weekStartISO: weekStart, weeklyExpected, sports: [...sports].sort(), teams: [] },
      counts: { total, withPlan, missingPlan, noCheckin, lowAdherence, onTrack },
    });
  } catch (err) {
    console.error("[org/nutrition/queue]", err);
    return res.status(500).json({ error: err?.message || "Failed to load nutrition queue." });
  }
}
