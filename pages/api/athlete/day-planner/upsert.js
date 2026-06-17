// pages/api/athlete/day-planner/upsert.js
// GET  ?date=YYYY-MM-DD - returns scheduled events for that day
// POST { date, events[] } - upserts events for that day

import { supabaseAdmin as db } from "@/lib/supabase";
import { requireAthlete } from "@/lib/requireAthlete";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const auth = requireAthlete(req);
  if (!auth?.ok) {
    return res.status(401).json({ ok: false, error: auth?.error || "Unauthorized" });
  }

  const athleteToken = String(auth.athlete?.AthleteToken || "").trim();
  if (!athleteToken) {
    return res.status(400).json({ ok: false, error: "AthleteToken missing from session" });
  }

  const date = String(req.query.date || req.body?.date || "").trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: "Invalid or missing date (expected YYYY-MM-DD)" });
  }

  // ── GET ───────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const { data, error } = await db
        .from("day_planner")
        .select("events_json")
        .eq("athlete_token", athleteToken)
        .eq("date", date)
        .maybeSingle();

      if (error) throw error;

      let events = [];
      if (data?.events_json) {
        events = Array.isArray(data.events_json)
          ? data.events_json
          : (() => { try { return JSON.parse(data.events_json); } catch { return []; } })();
      }

      return res.status(200).json({ ok: true, hasRecord: Boolean(data), events });
    } catch (err) {
      console.error("[day-planner GET]", err);
      return res.status(500).json({ ok: false, error: "Failed to fetch events", detail: err.message });
    }
  }

  // ── POST ──────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { events } = req.body || {};
    if (!Array.isArray(events)) {
      return res.status(400).json({ ok: false, error: "events must be an array" });
    }

    try {
      const { error } = await db
        .from("day_planner")
        .upsert({
          athlete_token: athleteToken,
          date,
          events_json:   events,
          updated_at:    new Date().toISOString(),
        }, { onConflict: "athlete_token,date" });

      if (error) throw error;

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[day-planner POST]", err);
      return res.status(500).json({ ok: false, error: "Failed to save events", detail: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
