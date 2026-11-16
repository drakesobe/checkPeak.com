// pages/api/org/today.js
// GET ?date=YYYY-MM-DD -> everything the coach's Today page needs in one call:
//   org:   { name, token }               team code athletes use to join
//   setup: { athletes, seasonSet, workouts, staff }   drives the getting-started checklist
//   today: { date, sessions[], totals }  today's workouts grouped into sessions
// Pending reviews and unread messages come from /api/org/nav-counts so the page and the
// navigation badges always agree.

import { requireOrg } from "@/lib/requireOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

const DONE = new Set(["completed", "complete", "approved"]);

function minutes(t) {
  const [h, m] = String(t || "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Not authenticated" });

  const orgToken = String(auth.org?.token || "").trim();
  if (!orgToken) return res.status(400).json({ error: "Your session is missing a team. Please sign in again." });

  // The browser sends its local date so "today" matches the coach's time zone
  const date = String(req.query?.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "date required (YYYY-MM-DD)" });

  try {
    const [org, athletes, anyWorkout, staff, todays] = await Promise.all([
      db.from("organizations").select("name, token, email, season_calendar").eq("token", orgToken).maybeSingle(),
      db.from("athletes").select("id", { count: "exact", head: true }).eq("org_token", orgToken),
      db.from("daily_workouts").select("id", { count: "exact", head: true }).eq("org_token", orgToken),
      db.from("org_members").select("email, active").eq("org_token", orgToken).limit(500),
      db.from("daily_workouts")
        .select("id, title, status, sport, scheduled_time, scheduled_duration")
        .eq("org_token", orgToken)
        .eq("date", date)
        .limit(2000),
    ]);

    // Staff other than the account owner (the owner may or may not have a member row)
    const ownerEmail = String(org.data?.email || "").trim().toLowerCase();
    const staffCount = (staff.data ?? []).filter((m) => m.active !== false && String(m.email || "").trim().toLowerCase() !== ownerEmail).length;
    const calendar = Array.isArray(org.data?.season_calendar) ? org.data.season_calendar : [];

    // Workouts are stored one row per athlete; group them into sessions the coach recognizes
    const groups = new Map();
    for (const w of todays.data ?? []) {
      const title = String(w.title || "Workout").trim();
      const key = `${title.toLowerCase()}|${w.scheduled_time || ""}`;
      const g = groups.get(key) ?? {
        title,
        time: w.scheduled_time ? String(w.scheduled_time).slice(0, 5) : null,
        duration: w.scheduled_duration ? Number(w.scheduled_duration) : null,
        sports: new Set(),
        assigned: 0, done: 0, review: 0,
      };
      g.assigned++;
      if (DONE.has(w.status)) g.done++;
      if (w.status === "pending_review") g.review++;
      if (w.sport) g.sports.add(w.sport);
      groups.set(key, g);
    }
    const sessions = [...groups.values()]
      .map((g) => ({ ...g, sports: [...g.sports] }))
      .sort((a, b) => (minutes(a.time) ?? 9999) - (minutes(b.time) ?? 9999) || a.title.localeCompare(b.title));

    const totals = sessions.reduce(
      (t, s) => ({ assigned: t.assigned + s.assigned, done: t.done + s.done }),
      { assigned: 0, done: 0 },
    );

    return res.status(200).json({
      ok: true,
      role: auth.user?.role || "",
      org: { name: org.data?.name || auth.org?.name || "Your program", token: org.data?.token || orgToken },
      setup: {
        athletes:  athletes.count ?? 0,
        seasonSet: calendar.length > 0,
        workouts:  anyWorkout.count ?? 0,
        staff:     staffCount,
      },
      today: { date, sessions, totals },
    });
  } catch (err) {
    console.error("[org/today]", err);
    return res.status(500).json({ error: "Could not load today's overview." });
  }
}
