// pages/api/athlete/getMyPrescriptions.js
// GET - returns this athlete's nutrition plans as "prescriptions".

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) { return String(v ?? "").trim(); }

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error });

  const athleteToken = asString(auth.athlete?.AthleteToken || auth.athlete?.athleteToken);
  const athleteEmail = asString(auth.athlete?.email);

  try {
    let query = db
      .from("nutrition_plans")
      .select("id, phase, prescription, status, created_at, created_by, org_token")
      .order("created_at", { ascending: false })
      .limit(50);

    if (athleteToken) {
      query = query.eq("athlete_token", athleteToken);
    } else if (athleteEmail) {
      // Fallback: look up athlete by email to get token
      const { data: athlete } = await db
        .from("athletes")
        .select("athlete_token")
        .eq("email", athleteEmail)
        .maybeSingle();
      if (athlete?.athlete_token) {
        query = query.eq("athlete_token", athlete.athlete_token);
      } else {
        return res.status(200).json({ prescriptions: [] });
      }
    } else {
      return res.status(401).json({ error: "No athlete identity in session." });
    }

    const { data: plans, error } = await query;
    if (error) throw error;

    const prescriptions = (plans || []).map(r => ({
      id:           r.id,
      athlete:      auth.athlete?.name || "",
      organization: r.org_token || "",
      title:        r.phase ? `Nutrition Plan • ${r.phase}` : "Nutrition Plan",
      prescription: asString(r.prescription),
      createdAt:    r.created_at || "",
      createdBy:    asString(r.created_by),
    }));

    return res.status(200).json({ prescriptions });
  } catch (err) {
    console.error("[getMyPrescriptions] error:", err);
    return res.status(500).json({ error: "Failed to fetch prescriptions.", details: String(err?.message || err) });
  }
}
