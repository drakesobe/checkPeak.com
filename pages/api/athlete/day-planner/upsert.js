// pages/api/athlete/day-planner/upsert.js
//
// FIX: added _authUser cookie fallback for React Native clients whose
// Cookie header gets mangled on JSON requests.

import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

const TABLE = process.env.DAYPLANNER_TABLE_ID || "DayPlannerBlocks";

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
  const date = String(req.query.date || req.body?.date || "").trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: "Invalid or missing date (expected YYYY-MM-DD)" });
  }

  // ── Airtable client ───────────────────────────────────────────────────────
  const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(
    process.env.ATHLETE_BASE_ID
  );

  const filter = `AND({AthleteToken}="${athleteToken}", {Date}="${date}")`;

  // ── GET: fetch saved events ───────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const records = await base(TABLE)
        .select({ filterByFormula: filter, maxRecords: 1 })
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
        .select({ filterByFormula: filter, maxRecords: 1 })
        .firstPage();

      if (existing.length) {
        await base(TABLE).update(existing[0].id, { EventsJSON: eventsJSON });
      } else {
        await base(TABLE).create({
          AthleteToken: athleteToken,
          Date:         date,
          EventsJSON:   eventsJSON,
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