// pages/api/athlete/library/index.js
// GET ?date=YYYY-MM-DD -> the athlete's team Workout Library.
// Response: { ok, program: { name } | null, sport, workouts: [card], addedOn: { [workoutId]: dailyWorkoutId } }
// addedOn lists library workouts already on the athlete's Today for `date`.

import { requireAthleteUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";
import { loadAthleteForLibrary, loadTeamLibrary, toLibraryCard, LIBRARY_SOURCE_PREFIX } from "@/lib/workoutLibrary";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const session = requireAthleteUser(req, res);
  if (!session) return;

  const athlete = await loadAthleteForLibrary(session);
  if (!athlete) return res.status(404).json({ error: "We couldn't find your athlete profile." });
  if (!athlete.org_token) {
    return res.status(200).json({ ok: true, program: null, sport: athlete.sport || "", workouts: [], addedOn: {} });
  }

  try {
    const { org, workouts } = await loadTeamLibrary(athlete.org_token);
    const cards = workouts.map(toLibraryCard).sort((a, b) => a.name.localeCompare(b.name));

    const addedOn = {};
    const date = String(req.query?.date || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const { data: rows } = await db
        .from("daily_workouts")
        .select("id, source_workout_id")
        .eq("athlete_id", athlete.id)
        .eq("date", date);
      for (const r of rows ?? []) {
        const src = String(r.source_workout_id || "");
        if (src.startsWith(LIBRARY_SOURCE_PREFIX)) addedOn[src.slice(LIBRARY_SOURCE_PREFIX.length)] = r.id;
      }
    }

    return res.status(200).json({ ok: true, program: org ? { name: org.name } : null, sport: athlete.sport || "", workouts: cards, addedOn });
  } catch (err) {
    console.error("[athlete/library]", err?.message || err);
    return res.status(500).json({ error: "Could not load your team's workouts." });
  }
}
