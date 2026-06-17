// pages/api/athlete/nutrition/profile.js
// GET - returns athlete info + latest active nutrition plan + recent check-ins.

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) { return String(v ?? "").trim(); }
function safeJsonParse(s) {
  const raw = asString(s);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const athleteToken = asString(auth.athlete?.AthleteToken || auth.user?.AthleteToken || "");
  const athleteEmail = asString(auth.athlete?.email || auth.user?.email || "").toLowerCase();

  if (!athleteToken && !athleteEmail) {
    return res.status(401).json({ error: "Athlete session missing token/email." });
  }

  try {
    // Resolve athlete record
    let athleteQuery = db.from("athletes").select("id, name, email, athlete_token");
    if (athleteToken) {
      athleteQuery = athleteQuery.eq("athlete_token", athleteToken);
    } else {
      athleteQuery = athleteQuery.eq("email", athleteEmail);
    }
    const { data: athleteRow } = await athleteQuery.maybeSingle();

    const resolvedToken = athleteToken || athleteRow?.athlete_token || "";
    const athlete = {
      id:           athleteRow?.id    || auth.athlete?.id || "",
      name:         athleteRow?.name  || auth.athlete?.name || "Athlete",
      email:        athleteRow?.email || athleteEmail,
      athleteToken: resolvedToken,
    };

    if (!resolvedToken) {
      return res.status(404).json({ error: "Athlete not found or missing AthleteToken.", debug: { athleteEmail } });
    }

    // Fetch latest active plan + recent check-ins in parallel
    const [plansResult, checkinsResult] = await Promise.all([
      db.from("nutrition_plans")
        .select("id, status, phase, daily_calories, daily_protein, daily_carbs, daily_fat, daily_hydration, plan_json, prescription, created_by, created_at, archived_at")
        .eq("athlete_token", resolvedToken)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1),

      db.from("nutrition_checkins")
        .select("id, week_start_iso, created_at, calories_pct, protein_pct, hydration_pct, carbs_pct, notes")
        .eq("athlete_token", resolvedToken)
        .order("week_start_iso", { ascending: false })
        .limit(12),
    ]);

    const latestRec = plansResult.data?.[0] || null;
    let latestPlan = null;
    if (latestRec) {
      const planJson = safeJsonParse(latestRec.plan_json);
      latestPlan = {
        id:    latestRec.id,
        phase: asString(latestRec.phase),
        daily: {
          calories:    asString(latestRec.daily_calories),
          protein:     asString(latestRec.daily_protein),
          carbs:       asString(latestRec.daily_carbs),
          fat:         asString(latestRec.daily_fat),
          hydrationOz: asString(latestRec.daily_hydration),
        },
        planJsonRaw:  typeof latestRec.plan_json === "string" ? latestRec.plan_json : JSON.stringify(latestRec.plan_json ?? ""),
        planJson,
        prescription: asString(latestRec.prescription),
        status:       "active",
        createdAt:    latestRec.created_at,
        createdBy:    asString(latestRec.created_by),
        archivedAt:   latestRec.archived_at || null,
        archivedBy:   null,
      };
    }

    const checkins = (checkinsResult.data ?? []).map(r => ({
      id:           r.id,
      weekStartISO: asString(r.week_start_iso),
      createdAt:    r.created_at,
      caloriesPct:  Number(r.calories_pct   || 0),
      proteinPct:   Number(r.protein_pct    || 0),
      carbsPct:     Number(r.carbs_pct      || 0),
      hydrationPct: Number(r.hydration_pct  || 0),
      notes:        asString(r.notes),
    }));

    return res.status(200).json({ ok: true, athlete, latestPlan, checkins });
  } catch (err) {
    console.error("[athlete/nutrition/profile]", err);
    return res.status(500).json({ error: err?.message || "Failed to load athlete nutrition profile." });
  }
}
