// pages/api/org/readiness.js
// GET ?date=YYYY-MM-DD — team readiness for the coach's org on a date.
// Response: {
//   ok, date,
//   summary:  { rosterSize, checkedIn, avgScore | null, flaggedCount },
//   athletes: [{ athleteToken, name, score, band, sleep, energy, soreness, stress, pain, painNote, flags[] }]
//             (checked-in athletes only; flagged first, then lowest score)
// }
// Requires supabase/athlete_readiness_migration.sql.

import { requireOrgSideUser }  from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";
import { readinessBand, readinessFlags } from "@/lib/readiness";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken = String(user.orgToken || user.Token || "").trim();
  if (!orgToken) return res.status(400).json({ error: "Missing org token on session." });

  const date = String(req.query?.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "date required (YYYY-MM-DD)" });

  try {
    const { data: roster, error: rErr } = await db
      .from("athletes")
      .select("athlete_token, name")
      .eq("org_token", orgToken);
    if (rErr) return res.status(500).json({ error: rErr.message });

    const names  = Object.fromEntries((roster ?? []).map(a => [a.athlete_token, a.name]));
    const tokens = Object.keys(names);
    if (!tokens.length) {
      return res.status(200).json({ ok: true, date, summary: { rosterSize: 0, checkedIn: 0, avgScore: null, flaggedCount: 0 }, athletes: [] });
    }

    // Match by roster membership (not org_token on the row) so athletes who joined
    // after their first check-in still show up.
    const { data: rows, error } = await db
      .from("athlete_readiness")
      .select("athlete_token, sleep, energy, soreness, stress, pain, pain_note, score")
      .in("athlete_token", tokens)
      .eq("log_date", date);
    if (error) return res.status(500).json({ error: error.message });

    const athletes = (rows ?? []).map(r => ({
      athleteToken: r.athlete_token,
      name:         names[r.athlete_token] || "Athlete",
      score:        r.score,
      band:         readinessBand(r.score),
      sleep:        r.sleep,
      energy:       r.energy,
      soreness:     r.soreness,
      stress:       r.stress,
      pain:         !!r.pain,
      painNote:     r.pain_note || null,
      flags:        readinessFlags(r),
    })).sort((a, b) => (b.flags.length > 0) - (a.flags.length > 0) || a.score - b.score);

    const checkedIn = athletes.length;
    return res.status(200).json({
      ok: true,
      date,
      summary: {
        rosterSize:   tokens.length,
        checkedIn,
        avgScore:     checkedIn ? Math.round(athletes.reduce((s, a) => s + a.score, 0) / checkedIn) : null,
        flaggedCount: athletes.filter(a => a.flags.length).length,
      },
      athletes,
    });
  } catch (err) {
    console.error("[org/readiness]", err);
    return res.status(500).json({ error: "Failed", details: err?.message });
  }
}
