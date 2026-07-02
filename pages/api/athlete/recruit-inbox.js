// pages/api/athlete/recruit-inbox.js
// GET  — return recruiter messages for the authenticated athlete (newest first)
// POST { id } — mark a single message as read

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

function getAthleteToken(auth) {
  return String(auth?.athlete?.AthleteToken || auth?.user?.AthleteToken || "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteToken = getAthleteToken(auth);
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  if (req.method === "GET") {
    const { data: messages, error } = await db
      .from("recruit_messages")
      .select("id, sender_name, sender_email, sender_org, message, read, created_at")
      .eq("athlete_token", athleteToken)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: "DB error" });

    const unread = (messages || []).filter(m => !m.read).length;
    return res.status(200).json({ ok: true, messages: messages || [], unread });
  }

  if (req.method === "POST") {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "Missing message id" });

    await db
      .from("recruit_messages")
      .update({ read: true })
      .eq("id", id)
      .eq("athlete_token", athleteToken);

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
