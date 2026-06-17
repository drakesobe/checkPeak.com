// pages/api/org/messages/thread.js
// GET ?athleteId=uuid&_authUser=... - fetch full message thread between coach and one athlete.
// Also marks incoming (from_coach=false) messages as read.

import { supabaseAdmin as db } from "@/lib/supabase";
import { readUserCookie }      from "@/lib/requireUser";

function parseUser(req) {
  const raw = req.query?._authUser;
  if (raw) {
    try { return JSON.parse(decodeURIComponent(String(raw))); } catch {}
  }
  return readUserCookie(req);
}

function getOrgToken(user) {
  return String(user?.orgToken || user?.Token || user?.token || "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgToken  = getOrgToken(user);
  const athleteId = String(req.query.athleteId || "").trim();
  if (!orgToken)  return res.status(400).json({ error: "Missing org token" });
  if (!athleteId) return res.status(400).json({ error: "athleteId is required" });

  try {
    const { data: messages, error } = await db
      .from("org_messages")
      .select("id, from_coach, text, sent_at")
      .eq("org_token", orgToken)
      .eq("athlete_id", athleteId)
      .order("sent_at", { ascending: true })
      .limit(200);

    if (error) throw error;

    // Mark unread athlete messages as read
    await db.from("org_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("org_token", orgToken)
      .eq("athlete_id", athleteId)
      .eq("from_coach", false)
      .is("read_at", null);

    return res.status(200).json({
      ok: true,
      messages: (messages ?? []).map(m => ({
        id:        m.id,
        text:      m.text,
        fromCoach: m.from_coach,
        sentAt:    m.sent_at,
      })),
    });
  } catch (err) {
    console.error("[org/messages/thread]", err);
    return res.status(500).json({ error: err.message });
  }
}
