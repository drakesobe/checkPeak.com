// pages/api/org/challenges.js
// Coach team challenges. Requires supabase/team_challenges_migration.sql.
//   GET                → { challenges: [{ id, title, metric, metricLabel, unit, goal, startDate, endDate, status,
//                           participants, completed, rosterSize, teamTotal, top: [{ name, value, rank, done }] }] }
//                        (active + upcoming + last 3 ended)
//   POST { title?, metric, goal?, startDate, endDate } → { ok, challenge }   (notifies the team)
//   DELETE ?id=…       → { ok }

import { requireOrgSideUser }  from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";
import { METRICS, isMetric, buildStandings, challengeStatus, todayISO } from "@/lib/challenges";
import { sendNotification } from "@/lib/sendNotification";

const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
const MAX_DAYS = 31;

function defaultTitle(metric, goal) {
  const m = METRICS[metric];
  if (!goal) return `Most ${m.short}`;
  return metric === "volume" ? `Lift ${goal.toLocaleString()} lb` : `${goal} ${m.short}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const user = requireOrgSideUser(req, res);
  if (!user) return;
  const orgToken = String(user.orgToken || user.Token || "").trim();
  if (!orgToken) return res.status(400).json({ error: "Missing org token on session." });

  try {
    if (req.method === "GET") {
      const today = todayISO();
      const [{ data: rows, error }, { data: roster }] = await Promise.all([
        db.from("team_challenges").select("*").eq("org_token", orgToken)
          .order("end_date", { ascending: false }).limit(20),
        db.from("athletes").select("athlete_token, name").eq("org_token", orgToken),
      ]);
      if (error) return res.status(500).json({ error: error.message });

      const list = (rows ?? []).map(c => ({ ...c, status: challengeStatus(c, today) }));
      const keep = [
        ...list.filter(c => c.status !== "ended"),
        ...list.filter(c => c.status === "ended").slice(0, 3),
      ];

      const challenges = await Promise.all(keep.map(async c => {
        const s = await buildStandings(c, roster ?? []);
        return {
          id: c.id, title: c.title, metric: c.metric,
          metricLabel: METRICS[c.metric].label, unit: METRICS[c.metric].unit,
          goal: c.goal, startDate: c.start_date, endDate: c.end_date, status: c.status,
          participants: s.participants, completed: s.completed, rosterSize: (roster ?? []).length, teamTotal: s.teamTotal,
          top: s.standings.filter(r => r.value > 0).slice(0, 5).map(r => ({ name: r.name, value: r.value, rank: r.rank, done: r.done })),
        };
      }));
      return res.status(200).json({ ok: true, challenges });
    }

    if (req.method === "POST") {
      const b = req.body || {};
      const metric = String(b.metric || "");
      if (!isMetric(metric)) return res.status(400).json({ error: "Unknown metric" });
      if (!isDate(b.startDate) || !isDate(b.endDate) || b.endDate < b.startDate) {
        return res.status(400).json({ error: "startDate and endDate required" });
      }
      const span = (new Date(`${b.endDate}T12:00:00Z`) - new Date(`${b.startDate}T12:00:00Z`)) / 86_400_000 + 1;
      if (span > MAX_DAYS) return res.status(400).json({ error: `Challenges can run up to ${MAX_DAYS} days.` });

      const goal  = b.goal != null && b.goal !== "" ? Math.round(Number(b.goal)) : null;
      if (goal != null && !(goal > 0)) return res.status(400).json({ error: "Goal must be a positive number" });
      const title = String(b.title || "").trim().slice(0, 80) || defaultTitle(metric, goal);

      const { data, error } = await db.from("team_challenges").insert({
        org_token: orgToken, title, metric, goal,
        start_date: b.startDate, end_date: b.endDate,
        created_by: String(user.email || user.Email || user.name || "").slice(0, 120) || null,
      }).select("*").single();
      if (error) return res.status(500).json({ error: error.message });

      // Tell the team (fire-and-forget).
      const { data: roster } = await db.from("athletes").select("athlete_token").eq("org_token", orgToken);
      const body = goal
        ? `${title} — hit ${goal.toLocaleString()} ${METRICS[metric].unit} by ${b.endDate.slice(5).replace("-", "/")}.`
        : `${title} — compete with your team through ${b.endDate.slice(5).replace("-", "/")}.`;
      sendNotification((roster ?? []).map(r => r.athlete_token), {
        title: "New team challenge", body, type: "challenge", data: { challengeId: data.id },
      });

      return res.status(201).json({ ok: true, challenge: data });
    }

    if (req.method === "DELETE") {
      const id = String(req.query.id || "").trim();
      if (!id) return res.status(400).json({ error: "id required" });
      const { error } = await db.from("team_challenges").delete().eq("id", id).eq("org_token", orgToken);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  } catch (err) {
    console.error("[org/challenges]", err);
    return res.status(500).json({ error: "Failed", details: err?.message });
  }
}
