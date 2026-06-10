// pages/api/org/nutrition/table.js
// GET — returns all org athletes with their latest nutrition plan + latest completion.

import { requireOrg } from "@/lib/requireOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) { return String(v ?? "").trim(); }
function clampPct(n) {
  const x = Math.round(Number(n));
  return Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : null;
}
function safeJsonParse(v) {
  if (!v) return null;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return null; }
}
function completionJsonToPcts(cj) {
  const c  = cj && typeof cj === "object" ? cj : {};
  const keys = ["breakfast", "lunch", "afternoon", "dinner"];
  let mealDone = 0;
  let waterDone = 0;
  for (const k of keys) {
    if (c?.[k]?.mealDone) mealDone++;
    if (c?.[k]?.hydrationDone) waterDone++;
  }
  return {
    mealPct:      clampPct((mealDone  / 4) * 100),
    hydrationPct: clampPct((waterDone / 4) * 100),
    totalPct:     clampPct(((mealDone + waterDone) / 8) * 100),
  };
}
function nyWeekStartISO(dateISO) {
  if (!dateISO || dateISO.length < 10) return "";
  const d = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow + 6) % 7);
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const orgToken = asString(auth?.org?.token);
  if (!orgToken) return res.status(401).json({ error: "Org token missing from session." });

  try {
    // Fetch roster
    const { data: athletes } = await db
      .from("athletes")
      .select("id, athlete_token, name, email, sport, status")
      .eq("org_token", orgToken)
      .eq("status", "active")
      .limit(2000);

    if (!athletes?.length) return res.status(200).json({ ok: true, rows: [] });

    const athleteTokens = athletes.map(a => a.athlete_token).filter(Boolean);

    // Fetch latest active plans for all tokens in one query
    const { data: plans } = await db
      .from("nutrition_plans")
      .select("id, athlete_token, status, phase, daily_calories, daily_protein, daily_carbs, daily_fat, daily_hydration, prescription, plan_json, created_by, created_at")
      .in("athlete_token", athleteTokens)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    // Latest active plan per athlete_token (first seen wins due to desc sort)
    const planByToken = new Map();
    for (const p of plans ?? []) {
      if (!planByToken.has(p.athlete_token)) planByToken.set(p.athlete_token, p);
    }

    // Fetch latest completion per athlete_token
    const { data: completions } = await db
      .from("nutrition_completions")
      .select("athlete_token, date, completion_json, updated_at")
      .in("athlete_token", athleteTokens)
      .order("date", { ascending: false })
      .order("updated_at", { ascending: false });

    const completionByToken = new Map();
    for (const c of completions ?? []) {
      if (!completionByToken.has(c.athlete_token)) completionByToken.set(c.athlete_token, c);
    }

    const rows = athletes.map(ath => {
      const tok = ath.athlete_token;
      const p   = tok ? planByToken.get(tok) : null;
      const c   = tok ? completionByToken.get(tok) : null;

      const plan = p ? {
        phase:  asString(p.phase),
        status: "active",
        daily: {
          calories:    asString(p.daily_calories),
          protein:     asString(p.daily_protein),
          carbs:       asString(p.daily_carbs),
          fat:         asString(p.daily_fat),
          hydrationOz: asString(p.daily_hydration),
        },
        createdAt: p.created_at,
        createdBy: asString(p.created_by),
      } : null;

      let completion = null;
      if (c) {
        const cj = safeJsonParse(c.completion_json);
        const pcts = completionJsonToPcts(cj);
        const dateISO = c.date ? String(c.date).slice(0, 10) : "";
        completion = {
          updatedAt:    c.updated_at,
          dateISO,
          weekStartISO: nyWeekStartISO(dateISO),
          totalPct:     pcts.totalPct,
          mealPct:      pcts.mealPct,
          hydrationPct: pcts.hydrationPct,
          caloriesPct:  null,
          proteinPct:   null,
          carbsPct:     null,
          notes:        "",
        };
      }

      return {
        athleteToken:  tok         || "",
        athleteName:   ath.name    || "Athlete",
        athleteEmail:  ath.email   || "",
        sport:         ath.sport   || "",
        plan,
        completion,
        rollup:        { last7Avg: null, last14Avg: null, streakDays: null, missedThisWeek: false },
        adherenceAvg:  clampPct(completion?.totalPct),
      };
    });

    return res.status(200).json({ ok: true, rows });
  } catch (err) {
    console.error("[org/nutrition/table]", err);
    return res.status(500).json({ error: err?.message || "Failed to load org nutrition table." });
  }
}
