// pages/api/athlete/nutrition/checkins/create.js
// POST { caloriesPct, proteinPct, carbsPct, hydrationPct, notes? }
// Upserts a weekly nutrition check-in in Supabase nutrition_checkins table.

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) { return String(v ?? "").trim(); }

function safeNum(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function clampInt(n, min, max) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

function nyWeekStartISO(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);

  const y   = parts.find(p => p.type === "year")?.value;
  const m   = parts.find(p => p.type === "month")?.value;
  const day = parts.find(p => p.type === "day")?.value;

  const nyMid    = new Date(`${y}-${m}-${day}T12:00:00`);
  const diffToMon = (nyMid.getDay() + 6) % 7;
  nyMid.setDate(nyMid.getDate() - diffToMon);

  const p2 = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(nyMid);

  return `${p2.find(p => p.type === "year")?.value}-${p2.find(p => p.type === "month")?.value}-${p2.find(p => p.type === "day")?.value}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const athleteToken = asString(
    auth?.athlete?.athleteToken || auth?.athlete?.token || auth?.athlete?.AthleteToken
  );

  if (!athleteToken || !athleteToken.toUpperCase().startsWith("ATH-")) {
    return res.status(401).json({ error: "AthleteToken missing from session." });
  }

  try {
    const body          = req.body || {};
    const weekStartISO  = nyWeekStartISO(new Date());

    const caloriesPct  = clampInt(safeNum(body.caloriesPct  ?? body.calories)   ?? 0, 0, 100);
    const proteinPct   = clampInt(safeNum(body.proteinPct   ?? body.protein)    ?? 0, 0, 100);
    const carbsPct     = clampInt(safeNum(body.carbsPct     ?? body.carbs)      ?? 0, 0, 100);
    const hydrationPct = clampInt(safeNum(body.hydrationPct ?? body.hydration)  ?? 0, 0, 100);
    const notes        = asString(body.notes);

    // Resolve athlete id
    const { data: athlete } = await db
      .from("athletes")
      .select("id")
      .eq("athlete_token", athleteToken)
      .maybeSingle();

    if (!athlete) {
      return res.status(404).json({ error: "Athlete not found.", athleteToken });
    }

    const nowISO = new Date().toISOString();

    const { data: saved, error } = await db
      .from("nutrition_checkins")
      .upsert({
        athlete_token:   athleteToken,
        athlete_id:      athlete.id,
        week_start_iso:  weekStartISO,
        calories_pct:    caloriesPct,
        protein_pct:     proteinPct,
        carbs_pct:       carbsPct,
        hydration_pct:   hydrationPct,
        notes,
        created_at:      nowISO,
      }, { onConflict: "athlete_token,week_start_iso" })
      .select("id")
      .single();

    if (error) throw error;

    return res.status(200).json({
      ok: true,
      weekStartISO,
      checkin: {
        id:            saved?.id,
        athleteToken,
        weekStartISO,
        caloriesPct,
        proteinPct,
        carbsPct,
        hydrationPct,
        notes,
        createdAt: nowISO,
      },
    });

  } catch (e) {
    console.error("[athlete/nutrition/checkins/create] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to submit check-in." });
  }
}
