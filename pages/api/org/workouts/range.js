// pages/api/org/workouts/range.js
// GET ?start=YYYY-MM-DD&end=YYYY-MM-DD[&sport=x] - workouts across a date range.

import { readUserCookie } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";

function parseOrgUser(req) {
  // Direct org_token bypass – mobile uses this (same pattern as getAthletesByToken)
  const directToken = String(req.query?.org_token || "").trim();
  if (directToken) return { Token: directToken, orgToken: directToken, role: "Organization" };

  const raw = req.query?._authUser ?? req.body?._authUser;
  if (raw) {
    try {
      const u = JSON.parse(decodeURIComponent(String(raw)));
      const role = String(u?.role || u?.Role || "").toLowerCase();
      if (role.includes("org") || role.includes("coach") || role.includes("train") || role.includes("admin")) return u;
    } catch {}
  }
  return readUserCookie(req);
}

function normLower(v) { return String(v ?? "").trim().toLowerCase(); }
function timeStrToMinutes(t) {
  if (!t) return null;
  const [h, m] = String(t).split(":").map(Number);
  return (isNaN(h) || isNaN(m)) ? null : h * 60 + m;
}

function parseSportsList(q) {
  const raw = String(q || "").trim();
  if (!raw) return [];
  if (raw.startsWith("[")) { try { const p = JSON.parse(raw); if (Array.isArray(p)) return p.map(normLower).filter(Boolean); } catch {} }
  return raw.split(/[,|]/g).map(normLower).filter(Boolean);
}

const WORKOUT_SELECT = `
  id, date, title, status, sport, athlete_token, scheduled_time, scheduled_duration,
  workout_items ( id, sort_order, exercise_name, group_id )
`;

function mapWorkout(dw, athleteSportMap) {
  return {
    id:                dw.id,
    Title:             dw.title  || "Workout",
    Date:              dw.date,
    Status:            dw.status || "assigned",
    Sport:             dw.sport  || athleteSportMap[dw.athlete_token] || "",
    athleteToken:      dw.athlete_token || "",
    ScheduledTime:     dw.scheduled_time     || null,
    ScheduledMinutes:  timeStrToMinutes(dw.scheduled_time),
    ScheduledDuration: dw.scheduled_duration ? Number(dw.scheduled_duration) : null,
    itemCount:         (dw.workout_items ?? []).length,
    items:             [...(dw.workout_items ?? [])]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(i => ({
        id:           i.id,
        ExerciseName: i.exercise_name || "",
        GroupId:      i.group_id      || null,
        Order:        i.sort_order    ?? 0,
      })),
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = parseOrgUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgToken  = String(user.orgToken || user.Token || "").trim();
  const startDate = String(req.query?.start || req.query?.startDate || "").slice(0, 10);
  const endDate   = String(req.query?.end   || req.query?.endDate   || "").slice(0, 10);
  const sports    = parseSportsList(req.query?.sport || req.query?.sports || "");

  if (!orgToken)  return res.status(400).json({ error: "Missing org token on session." });
  if (!startDate) return res.status(400).json({ error: "start is required (YYYY-MM-DD)" });
  if (!endDate)   return res.status(400).json({ error: "end is required (YYYY-MM-DD)" });

  try {
    // ── Primary: query by org_token ───────────────────────────────────────────────
    const { data: primaryData, error: primaryErr } = await db
      .from("daily_workouts")
      .select(WORKOUT_SELECT)
      .eq("org_token", orgToken)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date");

    if (primaryErr) throw primaryErr;

    let rawRows = primaryData ?? [];

    // ── Fallback: look up by athlete ownership ────────────────────────────────────
    // Covers token mismatches (e.g. Airtable migration: athletes.org_token matches
    // the mobile session but daily_workouts.org_token was stored under a different value).
    if (rawRows.length === 0) {
      const { data: orgAthletes } = await db
        .from("athletes")
        .select("id")
        .eq("org_token", orgToken);

      const athleteIds = (orgAthletes ?? []).map(a => a.id).filter(Boolean);

      if (athleteIds.length > 0) {
        const { data: fallbackData, error: fallbackErr } = await db
          .from("daily_workouts")
          .select(WORKOUT_SELECT)
          .in("athlete_id", athleteIds)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date");

        if (!fallbackErr) rawRows = fallbackData ?? [];
      }
    }

    // ── Build athlete→sport map ───────────────────────────────────────────────────
    const athleteTokens = [...new Set(rawRows.map(dw => dw.athlete_token).filter(Boolean))];
    let athleteSportMap = {};
    if (athleteTokens.length > 0) {
      const { data: athData } = await db
        .from("athletes")
        .select("athlete_token, sport")
        .in("athlete_token", athleteTokens);
      (athData ?? []).forEach(a => { if (a.athlete_token) athleteSportMap[a.athlete_token] = a.sport || ""; });
    }

    let workouts = rawRows.map(dw => mapWorkout(dw, athleteSportMap));

    if (sports.length) workouts = workouts.filter(w => sports.includes(normLower(w.Sport)));

    return res.status(200).json({ ok: true, workouts, startDate, endDate });
  } catch (err) {
    console.error("[org/workouts/range]", err);
    return res.status(500).json({ error: "Failed to load workouts.", details: err?.message });
  }
}
