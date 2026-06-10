// pages/api/athlete/teammates.js
// GET ?token= — returns all athletes in the same organization.
// Used by the mobile app to sync teammates to Firestore once per day.

import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) { return String(v ?? "").trim(); }

function getSessionUser(req) {
  try {
    const cookieHeader = req.headers.cookie || "";
    const cookies = {};
    cookieHeader.split(";").forEach(part => {
      const eqIdx = part.indexOf("=");
      if (eqIdx === -1) return;
      cookies[part.slice(0, eqIdx).trim()] = decodeURIComponent(part.slice(eqIdx + 1).trim());
    });
    const raw = cookies["user"];
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let orgToken = asString(req.query?.token || req.query?.orgToken || "");

  if (!orgToken) {
    const session = getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Not authenticated" });
    orgToken = asString(session.Token || session.token || session.OrgToken || session.orgToken || "");
  }

  if (!orgToken) {
    return res.status(400).json({ error: "No organization token found" });
  }

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
