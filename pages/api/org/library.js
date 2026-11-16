// pages/api/org/library.js
// GET -> the program's Workout Library for coaches: every saved workout (including ones hidden from
// athletes) plus how often athletes picked each one in the last 30 days.
// Response: { ok, workouts: [{ ...card, athleteVisible, uses30d, lastUsed }], totals: { uses30d, athletes30d } }
// Create/edit/delete go through /api/org/templates/{save,delete}.

import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";
import { toLibraryCard, LIBRARY_SOURCE_PREFIX } from "@/lib/workoutLibrary";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;
  const orgToken = String(user.orgToken || user.org_token || "").trim();
  if (!orgToken) return res.status(400).json({ error: "Your session is missing a team. Please sign in again." });

  try {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const [{ data: org, error }, { data: picks }] = await Promise.all([
      db.from("organizations").select("workout_templates").eq("token", orgToken).maybeSingle(),
      db.from("daily_workouts")
        .select("source_workout_id, athlete_id, date")
        .eq("org_token", orgToken)
        .gte("date", since)
        .like("source_workout_id", `${LIBRARY_SOURCE_PREFIX}%`)
        .limit(5000),
    ]);
    if (error) throw error;

    const usage = new Map();
    const athletes = new Set();
    for (const p of picks ?? []) {
      const id = String(p.source_workout_id || "").slice(LIBRARY_SOURCE_PREFIX.length);
      const u = usage.get(id) ?? { uses: 0, last: "" };
      u.uses++;
      if (p.date > u.last) u.last = p.date;
      usage.set(id, u);
      if (p.athlete_id) athletes.add(p.athlete_id);
    }

    const templates = Array.isArray(org?.workout_templates) ? org.workout_templates : [];
    const workouts = templates
      .filter((t) => t?.id)
      .map((t) => ({
        ...toLibraryCard(t),
        athleteVisible: t.athleteVisible !== false,
        uses30d: usage.get(String(t.id))?.uses || 0,
        lastUsed: usage.get(String(t.id))?.last || null,
        raw: t, // full saved workout so the editor can round-trip every field
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({
      ok: true,
      workouts,
      totals: { uses30d: (picks ?? []).length, athletes30d: athletes.size },
    });
  } catch (err) {
    console.error("[org/library]", err?.message || err);
    return res.status(500).json({ error: "Could not load the workout library." });
  }
}
