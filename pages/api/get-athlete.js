// pages/api/get-athlete.js
// GET /api/get-athlete?id=<uuid-or-athlete-token>

import { getAthleteById, getAthleteByToken, normalizeEmail } from "@/lib/supabaseOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) { return String(v ?? "").trim(); }

function formatAthlete(row) {
  return {
    id:           row.id,
    Name:         row.name         || "",
    Email:        row.email        || "",
    AthleteToken: row.athlete_token || "",
    OrgToken:     row.org_token    || "",
    Sport:        row.sport        || "",
    Status:       row.status       || "active",
    CreatedAt:    row.created_at   || "",
    role:         "Athlete",
    Role:         "Athlete",
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const rawId = asString(req.query?.id || req.query?.athleteId);
  if (!rawId) return res.status(400).json({ error: "id is required" });

  try {
    let athlete = null;

    // UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(rawId)) {
      const { data } = await getAthleteById(rawId);
      athlete = data;
    }
    // ATH- token
    else if (/^ATH-/i.test(rawId)) {
      const { data } = await getAthleteByToken(rawId);
      athlete = data;
    }
    // Email
    else if (rawId.includes("@")) {
      const { data } = await db
        .from("athletes")
        .select("*")
        .eq("email", normalizeEmail(rawId))
        .maybeSingle();
      athlete = data;
    }
    // Fallback: try by email or token
    else {
      const { data } = await getAthleteByToken(rawId);
      athlete = data;
    }

    if (!athlete) return res.status(404).json({ error: "Athlete not found" });

    return res.status(200).json({ athlete: formatAthlete(athlete) });
  } catch (err) {
    console.error("[get-athlete]", err);
    return res.status(500).json({ error: "Failed to fetch athlete.", details: err?.message });
  }
}
