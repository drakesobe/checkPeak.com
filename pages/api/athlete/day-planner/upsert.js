// pages/api/athlete/day-planner/upsert.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

const TABLE = process.env.DAYPLANNER_TABLE_ID || "DayPlannerBlocks";

export default async function handler(req, res) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = requireAthlete(req);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, error: auth.error || "Unauthorized" });
  }

  const athleteToken = String(auth.athlete?.AthleteToken || "").trim();
  if (!athleteToken) {
    return res.status(400).json({ ok: false, error: "AthleteToken missing from session" });
  }

  // ── Date param ────────────────────────────────────────────────────────────
  const date = String(req.query.date || "").trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: "Invalid or missing date (expected YYYY-MM-DD)" });
  }

  // ── Airtable client ───────────────────────────────────────────────────────
  const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(
    process.env.ATHLETE_BASE_ID
  );

  // ── GET: fetch saved events ───────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const records = await base(TABLE)
        .select({
          filterByFormula: `AND({AthleteToken}="${athleteToken}", {Date}="${date}")`,
          maxRecords: 1,
        })
        .firstPage();

      if (!records.length) {
        return res.json({ ok: true, hasRecord: false, events: [] });
      }

      let events = [];
      try { events = JSON.parse(records[0].fields.EventsJSON || "[]"); } catch { events = []; }

      return res.json({ ok: true, hasRecord: true, events });
    } catch (err) {
      console.error("[day-planner GET]", err);
      return res.status(500).json({ ok: false, error: "Failed to fetch events" });
    }
  }

  // ── POST: upsert events ───────────────────────────────────────────────────
  if (req.method === "POST") {
    const { events } = req.body || {};
    if (!Array.isArray(events)) {
      return res.status(400).json({ ok: false, error: "events must be an array" });
    }

    const eventsJSON = JSON.stringify(events);

    try {
      const existing = await base(TABLE)
        .select({
          filterByFormula: `AND({AthleteToken}="${athleteToken}", {Date}="${date}")`,
          maxRecords: 1,
        })
        .firstPage();

      if (existing.length) {
        await base(TABLE).update(existing[0].id, { EventsJSON: eventsJSON });
      } else {
        await base(TABLE).create({
          AthleteToken: athleteToken,
          Date: date,
          EventsJSON: eventsJSON,
        });
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error("[day-planner POST]", err);
      return res.status(500).json({ ok: false, error: "Failed to save events" });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}