// pages/api/org/workouts/range.js
// GET ?start=YYYY-MM-DD&end=YYYY-MM-DD[&sport=x] — workouts across a date range.

import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";

function normLower(v) { return String(v ?? "").trim().toLowerCase(); }

function parseSportsList(q) {
  const raw = String(q || "").trim();
  if (!raw) return [];
  if (raw.startsWith("[")) { try { const p = JSON.parse(raw); if (Array.isArray(p)) return p.map(normLower).filter(Boolean); } catch {} }
  return raw.split(/[,|]/g).map(normLower).filter(Boolean);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken  = String(user.orgToken || user.Token || "").trim();
  const startDate = String(req.query?.start || req.query?.startDate || "").slice(0, 10);
  const endDate   = String(req.query?.end   || req.query?.endDate   || "").slice(0, 10);
  const sports    = parseSportsList(req.query?.sport || req.query?.sports || "");

  if (!orgToken)  return res.status(400).json({ error: "Missing org token on session." });
  if (!startDate) return res.status(400).json({ error: "start is required (YYYY-MM-DD)" });
  if (!endDate)   return res.status(400).json({ error: "end is required (YYYY-MM-DD)" });

  try {
    const { data, error } = await db
      .from("daily_workouts")
      .select(`
        id, date, title, status, sport, athlete_token,
        workout_items ( id, sort_order, exercise_name, group_id )
      `)
      .eq("org_token", orgToken)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date");

    if (error) throw error;

    let workouts = (data ?? []).map(dw => ({
      id:           dw.id,
      Title:        dw.title  || "Workout",
      Date:         dw.date,
      Status:       dw.status || "assigned",
      Sport:        dw.sport  || "",
      athleteToken: dw.athlete_token || "",
      itemCount:    (dw.workout_items ?? []).length,
      items:        [...(dw.workout_items ?? [])].sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)).map(i => ({
        id:           i.id,
        ExerciseName: i.exercise_name || "",
        GroupId:      i.group_id      || null,
        Order:        i.sort_order    ?? 0,
      })),
    }));

    if (sports.length) workouts = workouts.filter(w => sports.includes(normLower(w.Sport)));

    return res.status(200).json({ ok: true, workouts, startDate, endDate });
  } catch (err) {
    console.error("[org/workouts/range]", err);
    return res.status(500).json({ error: "Failed to load workouts.", details: err?.message });
  }
}
