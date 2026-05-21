// pages/api/athlete/day-planner/upsert.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

const TABLE = process.env.DAYPLANNER_TABLE_ID || "DayPlannerBlocks";

// ── Find record by token + date ───────────────────────────────────────────────
// Uses .all() (real Promise), filters by token in Airtable,
// then compares date in JS to avoid IS_SAME() issues with Date fields.
// Among duplicates picks the record with the most EventsJSON content.
async function findRecord(base, athleteToken, date) {
  const safe = athleteToken.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const all = await base(TABLE)
    .select({ filterByFormula: `{AthleteToken}="${safe}"` })
    .all();

  const matches = all.filter(r =>
    String(r.fields.Date || "").slice(0, 10) === date
  );

  if (!matches.length) return null;

  // Prefer the record with the most content (handles old empty duplicates)
  return matches.sort((a, b) =>
    (b.fields.EventsJSON?.length ?? 0) - (a.fields.EventsJSON?.length ?? 0)
  )[0];
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const auth = requireAthlete(req);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, error: auth.error || "Unauthorized" });
  }

  const athleteToken = String(auth.athlete?.AthleteToken || "").trim();
  if (!athleteToken) {
    return res.status(400).json({ ok: false, error: "AthleteToken missing from session" });
  }

  const date = String(req.query.date || req.body?.date || "").trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: "Invalid or missing date (expected YYYY-MM-DD)" });
  }

  const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(
    process.env.ATHLETE_BASE_ID
  );

  // ── GET ───────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const record = await findRecord(base, athleteToken, date);
      if (!record) {
        return res.json({ ok: true, hasRecord: false, events: [] });
      }
      let events = [];
      try { events = JSON.parse(record.fields.EventsJSON || "[]"); } catch { events = []; }
      return res.json({ ok: true, hasRecord: true, events });
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
    const eventsJSON = JSON.stringify(events);
    try {
      const existing = await findRecord(base, athleteToken, date);
      if (existing) {
        await base(TABLE).update(existing.id, { EventsJSON: eventsJSON });
      } else {
        await base(TABLE).create({ AthleteToken: athleteToken, Date: date, EventsJSON: eventsJSON });
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error("[day-planner POST]", err);
      return res.status(500).json({ ok: false, error: "Failed to save events", detail: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}