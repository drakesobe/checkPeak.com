// pages/api/athlete/nutrition/completion.js
// GET  /api/athlete/nutrition/completion?date=YYYY-MM-DD  → fetch completion for date
// POST /api/athlete/nutrition/completion                   → upsert completion for date

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin } from "@/lib/supabase";

function asStr(v) { return String(v ?? "").trim(); }
function isISODate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s)); }

async function handleGet(req, res, athleteToken) {
  const date = asStr(req.query.date);
  if (!isISODate(date)) return res.status(400).json({ error: "Invalid date. Use YYYY-MM-DD." });

  const { data, error } = await supabaseAdmin
    .from("nutrition_completions")
    .select("completion_json, updated_at")
    .eq("athlete_token", athleteToken)
    .eq("date", date)
    .maybeSingle();

  if (error) {
    console.error("[athlete/nutrition/completion GET] db error:", error);
    return res.status(500).json({ error: "Failed to fetch completion." });
  }

  return res.status(200).json({
    completion: data?.completion_json ?? null,
    updatedAt:  data?.updated_at ?? null,
  });
}

async function handlePost(req, res, athleteToken, athleteId) {
  const { date, completionJson } = req.body ?? {};

  if (!isISODate(asStr(date))) return res.status(400).json({ error: "Invalid or missing date." });
  if (!completionJson || typeof completionJson !== "object") {
    return res.status(400).json({ error: "completionJson must be an object." });
  }

  const now = new Date().toISOString();

  // Manual upsert — nutrition_completions has no unique constraint, only an index
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("nutrition_completions")
    .select("id")
    .eq("athlete_token", athleteToken)
    .eq("date", date)
    .maybeSingle();

  if (selErr) {
    console.error("[athlete/nutrition/completion POST] select error:", selErr);
    return res.status(500).json({ error: "Database error." });
  }

  if (existing?.id) {
    const { error: upErr } = await supabaseAdmin
      .from("nutrition_completions")
      .update({ completion_json: completionJson, updated_at: now })
      .eq("id", existing.id);

    if (upErr) {
      console.error("[athlete/nutrition/completion POST] update error:", upErr);
      return res.status(500).json({ error: "Failed to update completion." });
    }
  } else {
    const { error: insErr } = await supabaseAdmin
      .from("nutrition_completions")
      .insert({
        athlete_token:   athleteToken,
        athlete_id:      athleteId || null,
        date,
        completion_json: completionJson,
        updated_at:      now,
      });

    if (insErr) {
      console.error("[athlete/nutrition/completion POST] insert error:", insErr);
      return res.status(500).json({ error: "Failed to save completion." });
    }
  }

  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteToken = asStr(auth.athlete?.AthleteToken);
  if (!athleteToken) return res.status(401).json({ error: "AthleteToken missing from session" });

  if (req.method === "GET")  return handleGet(req, res, athleteToken);
  if (req.method === "POST") return handlePost(req, res, athleteToken, auth.athlete?.id);

  return res.status(405).json({ error: "Method not allowed" });
}
