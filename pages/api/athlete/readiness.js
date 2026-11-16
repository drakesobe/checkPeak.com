// pages/api/athlete/readiness.js
// Morning readiness check-in.
//   GET  ?date=YYYY-MM-DD → { ok, entry | null, recent: [{ date, score }] (last 14 days, oldest first) }
//   POST { date, sleep, energy, soreness, stress, sleepHours?, pain?, painNote? } → { ok, entry }
// Requires supabase/athlete_readiness_migration.sql.

import { requireAthlete }  from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";
import { clamp15, readinessScore, readinessBand } from "@/lib/readiness";

const COLS = "log_date, sleep, energy, soreness, stress, sleep_hours, pain, pain_note, score, updated_at";

function getAthleteToken(auth) {
  return String(auth?.athlete?.AthleteToken || auth?.user?.AthleteToken || "").trim();
}

function shape(row) {
  if (!row) return null;
  return {
    date:       row.log_date,
    sleep:      row.sleep,
    energy:     row.energy,
    soreness:   row.soreness,
    stress:     row.stress,
    sleepHours: row.sleep_hours != null ? Number(row.sleep_hours) : null,
    pain:       !!row.pain,
    painNote:   row.pain_note || null,
    score:      row.score,
    band:       readinessBand(row.score),
    updatedAt:  row.updated_at,
  };
}

function isoDaysBefore(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  const athleteToken = getAthleteToken(auth);
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  if (req.method === "GET") {
    const date = String(req.query.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "date required (YYYY-MM-DD)" });

    const { data, error } = await db
      .from("athlete_readiness")
      .select(COLS)
      .eq("athlete_token", athleteToken)
      .gte("log_date", isoDaysBefore(date, 13))
      .lte("log_date", date)
      .order("log_date", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    const rows = data ?? [];
    return res.status(200).json({
      ok:     true,
      entry:  shape(rows.find(r => r.log_date === date)),
      recent: rows.map(r => ({ date: r.log_date, score: r.score })),
    });
  }

  if (req.method === "POST") {
    const b = req.body || {};
    const date = String(b.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "date required (YYYY-MM-DD)" });

    const vals = {
      sleep:    clamp15(b.sleep),
      energy:   clamp15(b.energy),
      soreness: clamp15(b.soreness),
      stress:   clamp15(b.stress),
    };
    if (Object.values(vals).some(v => v == null)) {
      return res.status(400).json({ error: "sleep, energy, soreness, stress must be 1–5" });
    }

    const hours = b.sleepHours != null && b.sleepHours !== "" ? Number(b.sleepHours) : null;
    const pain  = !!b.pain;

    const { data: ath } = await db
      .from("athletes")
      .select("org_token")
      .eq("athlete_token", athleteToken)
      .maybeSingle();

    const { data, error } = await db
      .from("athlete_readiness")
      .upsert({
        athlete_token: athleteToken,
        org_token:     ath?.org_token || null,
        log_date:      date,
        ...vals,
        sleep_hours:   Number.isFinite(hours) && hours >= 0 && hours <= 24 ? Math.round(hours * 10) / 10 : null,
        pain,
        pain_note:     pain ? (String(b.painNote || "").trim().slice(0, 200) || null) : null,
        score:         readinessScore(vals),
        updated_at:    new Date().toISOString(),
      }, { onConflict: "athlete_token,log_date" })
      .select(COLS)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, entry: shape(data) });
  }

  return res.status(405).end();
}
