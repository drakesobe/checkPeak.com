// pages/api/athlete/teammates.js
// GET ?token= - returns all athletes in the same organization.
// Used by the mobile app to sync teammates to Firestore once per day.

import { supabaseAdmin as db } from "@/lib/supabase";
import { requireUser } from "@/lib/requireUser";

function asString(v) { return String(v ?? "").trim(); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Only your own team. Staff team codes are signed into the session; an athlete's team
  // is read from the database because athletes can switch teams from the app.
  const session = requireUser(req, res);
  if (!session) return;
  let myTeam = "";
  if (session.role === "athlete") {
    const athleteToken = asString(session.athlete_token || session.AthleteToken || session.athleteToken);
    const q = db.from("athletes").select("org_token").limit(1);
    const { data: rows } = athleteToken ? await q.eq("athlete_token", athleteToken) : await q.eq("email", session.email);
    const me = rows?.[0];
    myTeam = asString(me?.org_token);
  } else {
    myTeam = asString(session.orgToken || session.org_token);
  }
  const asked = asString(req.query?.token || req.query?.orgToken || "");
  if (!myTeam) return res.status(400).json({ error: "You are not on a team yet." });
  if (asked && asked.toUpperCase() !== myTeam.toUpperCase()) {
    return res.status(403).json({ error: "Not authorized for this team." });
  }
  const orgToken = myTeam;

  try {
    const { data: records, error } = await db
      .from("athletes")
      .select("id, name, email, phone, sport, athlete_token, org_token")
      .eq("org_token", orgToken);

    if (error) throw error;

    const teammates = (records || []).map(r => ({
      id:           r.id,
      name:         asString(r.name),
      email:        asString(r.email).toLowerCase(),
      phone:        asString(r.phone),
      sport:        asString(r.sport).toLowerCase(),
      role:         "Athlete",
      athleteToken: asString(r.athlete_token),
      orgToken:     asString(r.org_token),
    }));

    return res.status(200).json({ ok: true, teammates, count: teammates.length });
  } catch (err) {
    console.error("[teammates] error:", err);
    return res.status(500).json({ error: "Failed to fetch teammates", details: asString(err?.message) });
  }
}
