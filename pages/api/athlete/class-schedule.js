// pages/api/athlete/class-schedule.js
// GET  — returns recurring class schedules for this athlete
// POST { schedules[] } — upserts recurring class schedules
//
// Schedules are stored as a JSONB blob in the class_schedules table.
// Auth: _authUser cookie fallback for React Native.

import { supabaseAdmin as db } from "@/lib/supabase";
import { requireAthlete } from "@/lib/requireAthlete";

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

  if (cookieMissingOrBroken(req)) {
    const authUserField = String(req.query?._authUser || req.body?._authUser || "").trim();
    if (authUserField) injectAuthFromField(req, authUserField);
  }

  const auth = requireAthlete(req);
  if (!auth?.ok) return res.status(401).json({ ok: false, error: auth?.error || "Unauthorized" });

  const athleteToken = String(auth.athlete?.AthleteToken || "").trim();
  if (!athleteToken) return res.status(400).json({ ok: false, error: "AthleteToken missing" });

  // ── GET ───────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const { data, error } = await db
        .from("class_schedules")
        .select("schedules_json")
        .eq("athlete_token", athleteToken)
        .maybeSingle();

      if (error) throw error;

      let schedules = [];
      if (data?.schedules_json) {
        schedules = Array.isArray(data.schedules_json)
          ? data.schedules_json
          : (() => { try { return JSON.parse(data.schedules_json); } catch { return []; } })();
      }

      return res.status(200).json({ ok: true, schedules });
    } catch (err) {
      console.error("[class-schedule GET]", err);
      return res.status(500).json({ ok: false, error: "Failed to fetch class schedules" });
    }
  }

  // ── POST ──────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { schedules } = req.body || {};
    if (!Array.isArray(schedules)) {
      return res.status(400).json({ ok: false, error: "schedules must be an array" });
    }

    try {
      const { error } = await db
        .from("class_schedules")
        .upsert({
          athlete_token:  athleteToken,
          schedules_json: schedules,
          updated_at:     new Date().toISOString(),
        }, { onConflict: "athlete_token" });

      if (error) throw error;

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[class-schedule POST]", err);
      return res.status(500).json({ ok: false, error: "Failed to save class schedules" });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
