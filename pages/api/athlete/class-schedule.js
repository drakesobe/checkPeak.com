// pages/api/athlete/class-schedule.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

const TABLE = process.env.CLASS_SCHEDULE_TABLE_ID || "ClassSchedules";

export default async function handler(req, res) {
  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ ok: false, error: auth.error || "Unauthorized" });

  const athleteToken = String(auth.athlete?.AthleteToken || "").trim();
  if (!athleteToken) return res.status(400).json({ ok: false, error: "AthleteToken missing" });

  const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(process.env.ATHLETE_BASE_ID);

  // ── GET: load schedules ─────────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const records = await base(TABLE)
        .select({ filterByFormula: `{AthleteToken}="${athleteToken}"`, maxRecords: 1 })
        .firstPage();

      if (!records.length) return res.json({ ok: true, schedules: [] });

      let schedules = [];
      try { schedules = JSON.parse(records[0].fields.SchedulesJSON || "[]"); } catch {}
      return res.json({ ok: true, schedules });
    } catch (err) {
      console.error("[class-schedule GET]", err);
      return res.status(500).json({ ok: false, error: "Failed to fetch class schedules" });
    }
  }

  // ── POST: upsert schedules ──────────────────────────────────────────────────
  if (req.method === "POST") {
    const { schedules } = req.body || {};
    if (!Array.isArray(schedules)) return res.status(400).json({ ok: false, error: "schedules must be an array" });

    const schedulesJSON = JSON.stringify(schedules);

    try {
      const existing = await base(TABLE)
        .select({ filterByFormula: `{AthleteToken}="${athleteToken}"`, maxRecords: 1 })
        .firstPage();

      if (existing.length) {
        await base(TABLE).update(existing[0].id, { SchedulesJSON: schedulesJSON });
      } else {
        await base(TABLE).create({ AthleteToken: athleteToken, SchedulesJSON: schedulesJSON });
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error("[class-schedule POST]", err);
      return res.status(500).json({ ok: false, error: "Failed to save class schedules" });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}