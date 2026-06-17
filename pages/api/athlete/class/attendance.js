// pages/api/athlete/class/attendance.js
// GET ?date=YYYY-MM-DD - returns the class IDs the athlete attended on that date.

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) { return String(v ?? "").trim(); }
function isISODateOnly(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim()); }

function cookieMissingOrBroken(req) {
  try {
    const raw = req?.cookies?.user || "";
    if (!raw) return true;
    const decoded = raw.includes("%7B") || raw.includes("%22") ? decodeURIComponent(raw) : raw;
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

  try {
    const { data: records, error } = await db
      .from("class_attendance")
      .select("class_id")
      .eq("athlete_token", athleteToken)
      .eq("attended_at", date);

    if (error) throw error;

    const classIds = (records || [])
      .map(r => asString(r.class_id))
      .filter(Boolean);

    return res.status(200).json({ ok: true, date, classIds });
  } catch (e) {
    console.error("[class/attendance GET]", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
