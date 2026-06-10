// pages/api/update-athlete.js
// PATCH /api/update-athlete  { id, name?, sport?, status?, orgToken? }

import { supabaseAdmin as db } from "@/lib/supabase";
import { requireUser } from "@/lib/requireUser";
import { normalizeEmail } from "@/lib/supabaseOrg";

function asString(v) { return String(v ?? "").trim(); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireUser(req, res);
  if (!user) return;

  const { id, athleteToken, name, sport, status, email, orgToken } = req.body || {};

  const identifier = asString(id || athleteToken);
  if (!identifier) return res.status(400).json({ error: "id or athleteToken is required" });

  const update = {};
  if (name      !== undefined) update.name      = asString(name);
  if (sport     !== undefined) update.sport     = asString(sport) || null;
  if (status    !== undefined) update.status    = asString(status) || "active";
  if (email     !== undefined) update.email     = normalizeEmail(email);
  if (orgToken  !== undefined) update.org_token = asString(orgToken) || null;

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: "No fields to update." });
  }

  try {
    let query = db.from("athletes").update(update).select("id, email, name, athlete_token, sport, status");

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(identifier)) {
      query = query.eq("id", identifier);
    } else if (/^ATH-/i.test(identifier)) {
      query = query.eq("athlete_token", identifier);
    } else {
      return res.status(400).json({ error: "id must be a UUID or ATH- token" });
    }

    const { data, error } = await query.single();

    if (error) {
      console.error("[update-athlete]", error);
      return res.status(500).json({ error: "Failed to update athlete.", details: error.message });
    }

    return res.status(200).json({ ok: true, athlete: data });
  } catch (err) {
    console.error("[update-athlete]", err);
    return res.status(500).json({ error: "Failed to update athlete.", details: err?.message });
  }
}
