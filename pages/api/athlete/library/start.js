// pages/api/athlete/library/start.js
// POST { workoutId, date: "YYYY-MM-DD" } -> adds a team library workout to the athlete's Today.
// Response: { ok, dailyWorkoutId, alreadyAdded }
// Only workouts from the athlete's own team that the coach left visible can be started.

import { requireAthleteUser } from "@/lib/requireUser";
import { loadAthleteForLibrary, loadTeamLibrary, startLibraryWorkout } from "@/lib/workoutLibrary";

const DAY = 24 * 3600 * 1000;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = requireAthleteUser(req, res);
  if (!session) return;

  const workoutId = String(req.body?.workoutId || "").trim();
  const date = String(req.body?.date || "").slice(0, 10);
  if (!workoutId) return res.status(400).json({ error: "Choose a workout." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Choose a day." });
  // Today or the next week (time zones put "today" up to a day either side of the server)
  const offset = (Date.parse(`${date}T12:00:00Z`) - Date.now()) / DAY;
  if (!(offset > -2 && offset < 8)) return res.status(400).json({ error: "Pick today or a day this week." });

  const athlete = await loadAthleteForLibrary(session);
  if (!athlete?.org_token) return res.status(403).json({ error: "Join your team to use its workout library." });

  try {
    const { org, workouts } = await loadTeamLibrary(athlete.org_token);
    const template = workouts.find((t) => String(t.id) === workoutId);
    if (!template) return res.status(404).json({ error: "That workout isn't in your team's library anymore." });

    const result = await startLibraryWorkout({ athlete, orgId: org?.id, template, date });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error("[athlete/library/start]", err?.message || err);
    return res.status(500).json({ error: "Could not add the workout. Try again." });
  }
}
