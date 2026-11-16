// pages/api/notifications/save-token.js
// Saves an Expo push token to the athlete's Supabase record.
// POST { athleteId?, athleteToken?, token }

import { supabaseAdmin as db } from "@/lib/supabase";
import { requireAthleteUser } from "@/lib/requireUser";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Push tokens can only be registered for the signed-in athlete
  const me = requireAthleteUser(req, res);
  if (!me) return;
  const athleteId    = String(me.id || me.athleteId || "").trim();
  const athleteToken = String(me.AthleteToken || me.athleteToken || me.athlete_token || "").trim();
  const { token } = req.body || {};

  if ((!athleteId && !athleteToken) || !token) {
    return res.status(400).json({ error: "A push token is required." });
  }

  try {
    let query = db.from("athletes").update({ push_token: token });

    if (athleteId) {
      query = query.eq("id", athleteId);
    } else {
      query = query.eq("athlete_token", athleteToken);
    }

    const { error } = await query;
    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[save-token] Error:", err);
    return res.status(500).json({ error: "Failed to save push token" });
  }
}
