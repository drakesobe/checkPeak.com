// pages/api/get-athletes.js
import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) {
  return String(v ?? "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = asString(req.query?.id || req.query?.athleteId);
  if (!id) {
    return res.status(400).json({ error: "Athlete ID is required" });
  }

  try {
    const { data: row, error } = await db
      .from("athletes")
      .select("id, name, email, phone, org_token, athlete_token, status, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!row) return res.status(404).json({ error: "Athlete not found" });

    const athlete = {
      id:           row.id,
      name:         asString(row.name),
      email:        asString(row.email).toLowerCase(),
      phone:        asString(row.phone),
      orgToken:     asString(row.org_token),
      athleteToken: asString(row.athlete_token),
      title:        "Athlete",
      role:         "Athlete",
      createdAt:    row.created_at || "",
      raw: {
        Name:         row.name         || "",
        Email:        row.email        || "",
        Phone:        row.phone        || "",
        Token:        row.org_token    || "",
        AthleteToken: row.athlete_token || "",
      },
    };

    return res.status(200).json({ ok: true, athlete });
  } catch (err) {
    console.error("[get-athletes] error:", err);
    return res.status(500).json({ error: "Failed to fetch athlete", details: asString(err?.message || err) });
  }
}
