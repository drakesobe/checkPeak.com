// pages/api/athlete/nutrition/today.js
// GET ?date=YYYY-MM-DD — returns the active nutrition plan effective for the given date.

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) { return String(v ?? "").trim(); }
function isISODateOnly(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim()); }
function nyISODate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}
function safeJsonParse(s) {
  const raw = asString(s);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch {
    try { return JSON.parse(raw.replace(/\\([^"\\\/bfnrtu])/g, "$1")); } catch { return null; }
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const dateQ        = asString(req.query?.date);
  const selectedDate = isISODateOnly(dateQ) ? dateQ : nyISODate();

  let athleteToken = asString(auth.athlete?.AthleteToken || auth.user?.AthleteToken || "");
  const athleteEmail = asString(auth.athlete?.email || auth.user?.email || "").toLowerCase();

  // Resolve token from DB if missing
  if (!athleteToken && athleteEmail) {
    const { data: athlete } = await db
      .from("athletes")
      .select("athlete_token")
      .eq("email", athleteEmail)
      .maybeSingle();
    athleteToken = athlete?.athlete_token || "";
  }

  if (!athleteToken) {
    return res.status(401).json({ error: "Athlete session missing AthleteToken.", debug: { selectedDate } });
  }

  try {
    // Fetch active plans with optional effective_date filtering
    const { data: rows, error } = await db
      .from("nutrition_plans")
      .select("id, status, phase, daily_calories, daily_protein, daily_carbs, daily_fat, daily_hydration, plan_json, prescription, created_by, created_at, effective_date")
      .eq("athlete_token", athleteToken)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) {
      console.error("[athlete/nutrition/today] supabase:", error);
      return res.status(500).json({ error: "Failed to load nutrition plan." });
    }

    const candidates = (rows ?? []).map(r => {
      const effectiveDate = r.effective_date
        ? String(r.effective_date).slice(0, 10)
        : (r.created_at ? String(r.created_at).slice(0, 10) : "");
      return { ...r, effectiveDate };
    });

    // Pick plan effective on selectedDate (most recent effective date <= selectedDate)
    const effective = candidates.filter(p => !p.effectiveDate || p.effectiveDate <= selectedDate);
    const picked    = effective[0] || null;

    let upcoming = null;
    for (const p of candidates) {
      if (!p.effectiveDate || p.effectiveDate <= selectedDate) continue;
      if (!upcoming || p.effectiveDate < upcoming.effectiveDate) upcoming = p;
    }

    if (!picked) {
      return res.status(200).json({
        ok: true,
        selectedDate,
        athleteToken,
        athleteEmail,
        latestPlan: null,
        nextPlan: upcoming ? { effectiveDate: upcoming.effectiveDate, createdAt: upcoming.created_at } : null,
        message: upcoming
          ? `No plan is effective on ${selectedDate}. Next plan starts ${upcoming.effectiveDate}.`
          : `No active plan is effective on ${selectedDate}.`,
      });
    }

    // plan_json is a JSONB column — Supabase returns it already parsed as an object.
    // safeJsonParse calls asString() first which coerces objects to "[object Object]",
    // so we must branch on the type before trying to parse.
    const rawPlanJson = picked.plan_json;
    let planJson = rawPlanJson == null
      ? null
      : typeof rawPlanJson === "object"
        ? rawPlanJson
        : safeJsonParse(rawPlanJson);

    // Auto-derive per-meal mealBlocks when plan_json has none.
    // Covers plans created before per-meal distribution was added to the org sidebar.
    if (!planJson?.mealBlocks) {
      const cal  = Number(picked.daily_calories) || 0;
      const pro  = Number(picked.daily_protein)  || 0;
      const carb = Number(picked.daily_carbs)    || 0;
      const fat  = Number(picked.daily_fat)      || 0;
      if (cal || pro) {
        const SPLITS = { breakfast: 0.25, lunch: 0.30, afternoon: 0.15, dinner: 0.30 };
        const LABELS = { breakfast: "Breakfast", lunch: "Lunch", afternoon: "Afternoon", dinner: "Dinner" };
        const mealBlocks = {};
        for (const [key, pct] of Object.entries(SPLITS)) {
          mealBlocks[key] = {
            name: LABELS[key],
            targets: {
              calories: cal  ? Math.round(cal  * pct) : null,
              protein:  pro  ? Math.round(pro  * pct) : null,
              carbs:    carb ? Math.round(carb * pct) : null,
              fat:      fat  ? Math.round(fat  * pct) : null,
            },
          };
        }
        planJson = { ...(planJson || {}), mealBlocks };
      }
    }

    const latestPlan = {
      id:    picked.id,
      phase: asString(picked.phase),
      daily: {
        calories:    asString(picked.daily_calories),
        protein:     asString(picked.daily_protein),
        carbs:       asString(picked.daily_carbs),
        fat:         asString(picked.daily_fat),
        hydrationOz: asString(picked.daily_hydration),
      },
      planJsonRaw:  typeof picked.plan_json === "string" ? picked.plan_json : JSON.stringify(picked.plan_json ?? ""),
      planJson,
      prescription:  asString(picked.prescription),
      status:        "active",
      createdAt:     picked.created_at,
      createdBy:     asString(picked.created_by),
      effectiveDate: picked.effectiveDate || "",
    };

    return res.status(200).json({
      ok: true,
      selectedDate,
      athleteToken,
      athleteEmail,
      latestPlan,
      nextPlan: upcoming ? { effectiveDate: upcoming.effectiveDate, createdAt: upcoming.created_at } : null,
    });
  } catch (err) {
    console.error("[athlete/nutrition/today]", err);
    return res.status(500).json({ error: err?.message || "Failed to load athlete nutrition plan." });
  }
}
