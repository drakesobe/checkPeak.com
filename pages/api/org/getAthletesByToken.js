// pages/api/org/getAthletesByToken.js
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const { token } = req.query || {};
  if (!token) return res.status(400).json({ error: "Missing token" });

  try {
    const { data: rows, error } = await db
      .from("athletes")
      .select("id, name, email, created_at, org_token, athlete_token, status, sport")
      .eq("org_token", String(token).trim())
      .order("created_at", { ascending: false });

    if (error) throw error;

    const athletes = (rows || []).map(r => ({
      id:           r.id,
      name:         r.name         || "",
      email:        r.email        || "",
      createdAt:    r.created_at   || "",
      token:        r.org_token    || "",
      athleteToken: r.athlete_token || "",
      sport:        r.sport        || "",
      role:         "Athlete",
      title:        "Athlete",
    }));

    return res.status(200).json({ athletes });
  } catch (err) {
    console.error("[getAthletesByToken] error:", err);
    return res.status(500).json({ error: "Failed to fetch athletes." });
  }
}
