// pages/api/athlete/class/attendance.js
//
// GET /api/athlete/class/attendance?date=YYYY-MM-DD
// Returns the ClassIds the athlete has submitted attendance for on that date.
// Used by the app on load to restore the done state of class rows.

import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

const ATHLETE_API_KEY  = process.env.ATHLETE_API_KEY;
const ATHLETE_BASE_ID  = process.env.ATHLETE_BASE_ID;
const ATTENDANCE_TABLE = process.env.CLASS_ATTENDANCE_TABLE || "ClassAttendance";

function asString(v) { return String(v ?? "").trim(); }
function escapeAirtable(str = "") { return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'"); }
function isISODateOnly(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim()); }

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

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Auth fallback for React Native
  if (cookieMissingOrBroken(req)) {
    const authUserField = asString(req.query?._authUser || "");
    if (authUserField) injectAuthFromField(req, authUserField);
  }

  const auth = requireAthlete(req);
  if (!auth?.ok) {
    return res.status(401).json({ ok: false, error: auth?.error || "Unauthorized" });
  }

  const athleteToken =
    asString(auth?.athlete?.AthleteToken) ||
    asString(auth?.athlete?.athleteToken) ||
    asString(auth?.user?.AthleteToken)    ||
    asString(auth?.user?.athleteToken);

  if (!athleteToken) {
    return res.status(400).json({ ok: false, error: "AthleteToken missing" });
  }

  const date = asString(req.query?.date || "");
  if (!isISODateOnly(date)) {
    return res.status(400).json({ ok: false, error: "date is required (YYYY-MM-DD)" });
  }

  if (!ATHLETE_API_KEY || !ATHLETE_BASE_ID) {
    return res.status(500).json({ ok: false, error: "Airtable not configured." });
  }

  const base = new Airtable({ apiKey: ATHLETE_API_KEY }).base(ATHLETE_BASE_ID);
  const isoMidDay = `${date}T12:00:00.000Z`;

  try {
    const records = await base(ATTENDANCE_TABLE)
      .select({
        filterByFormula: `AND(
          {AthleteToken} = '${escapeAirtable(athleteToken)}',
          IS_SAME({Date}, '${isoMidDay}', 'day')
        )`,
        fields:     ["ClassId"],
        maxRecords: 100,
      })
      .firstPage();

    const classIds = records
      .map(r => asString(r.fields?.ClassId))
      .filter(Boolean);

    return res.status(200).json({ ok: true, date, classIds });
  } catch (e) {
    console.error("[class/attendance GET]", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}