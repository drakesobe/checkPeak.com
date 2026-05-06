// pages/api/athlete/class-schedule.js
//
// CHANGED: now reads/writes SchedulesJSON in DayPlannerBlocks table
// (same table the day planner uses) instead of a separate ClassSchedules table.
// Recurring schedules are stored on a sentinel record with Date = "recurring"
// so they don't collide with day-specific EventsJSON records.
//
// Auth: same _authUser cookie fallback for React Native multipart/JSON requests.

import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

const TABLE          = process.env.DAYPLANNER_TABLE_ID || "DayPlannerBlocks";
const RECURRING_DATE = "recurring"; // sentinel - no real date, just schedules

// ── Auth cookie fallback ──────────────────────────────────────────────────────
function cookieMissingOrBroken(req) {
  try {
    const raw = req?.cookies?.user || "";
    if (!raw) return true;
    const decoded = raw.includes("%7B") || raw.includes("%22")
      ? decodeURIComponent(raw) : raw;
    JSON.parse(decoded);
    return false;
  } catch { return true; }
}

function injectAuthFromField(req, authUserField) {
  if (!authUserField) return;
  req.cookies        = req.cookies || {};
  req.cookies.user   = authUserField;
  req.headers        = req.headers || {};
  req.headers.cookie = `user=${encodeURIComponent(authUserField)}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // ── Auth fallback for React Native ─────────────────────────────────────────
  if (cookieMissingOrBroken(req)) {
    const authUserField = String(
      req.query?._authUser ||
      req.body?._authUser  ||
      ""
    ).trim();
    if (authUserField) injectAuthFromField(req, authUserField);
  }

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ ok: false, error: auth.error || "Unauthorized" });

  const athleteToken = String(auth.athlete?.AthleteToken || "").trim();
  if (!athleteToken) return res.status(400).json({ ok: false, error: "AthleteToken missing" });

  const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY })
    .base(process.env.ATHLETE_BASE_ID);

  // Find the recurring schedules record for this athlete
  const filter = `AND({AthleteToken}="${athleteToken}", {Date}="${RECURRING_DATE}")`;

  // ── GET: load schedules ───────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const records = await base(TABLE)
        .select({ filterByFormula: filter, maxRecords: 1 })
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

  // ── POST: upsert schedules ────────────────────────────────────────────────
  if (req.method === "POST") {
    const { schedules } = req.body || {};
    if (!Array.isArray(schedules)) {
      return res.status(400).json({ ok: false, error: "schedules must be an array" });
    }

    const schedulesJSON = JSON.stringify(schedules);

    try {
      const existing = await base(TABLE)
        .select({ filterByFormula: filter, maxRecords: 1 })
        .firstPage();

      if (existing.length) {
        await base(TABLE).update(existing[0].id, { SchedulesJSON: schedulesJSON });
      } else {
        await base(TABLE).create({
          AthleteToken:  athleteToken,
          Date:          RECURRING_DATE,
          SchedulesJSON: schedulesJSON,
        });
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error("[class-schedule POST]", err);
      return res.status(500).json({ ok: false, error: "Failed to save class schedules" });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}