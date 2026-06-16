// pages/api/org/messages/send.js
// POST — coach sends a message to an athlete.
// Body: { athleteId, athleteName, text, _authUser? }

import { supabaseAdmin as db } from "@/lib/supabase";
import { readUserCookie }      from "@/lib/requireUser";

function parseUser(req) {
  const raw = req.body?._authUser;
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
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgToken = getOrgToken(user);
  if (!orgToken) return res.status(400).json({ error: "Missing org token" });

  const { athleteId, athleteName, text } = req.body || {};
  if (!athleteId || !text) {
    return res.status(400).json({ error: "athleteId and text are required" });
  }

  try {
    const { data, error } = await db.from("org_messages").insert({
      org_token:    orgToken,
      athlete_id:   String(athleteId),
      athlete_name: String(athleteName || "Athlete").trim(),
      from_coach:   true,
      text:         String(text).trim(),
    }).select().single();

    if (error) throw error;

    // Fire-and-forget push notification to athlete
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "https://www.checkpeak.com"}/api/notifications/send`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          athleteIds: [athleteId],
          title:      "New message from your coach",
          body:       String(text).slice(0, 100),
          type:       "new_message",
        }),
      });
    } catch {
      // Non-fatal — message is saved regardless
    }

    return res.status(201).json({
      ok:      true,
      message: { id: data.id, text: data.text, fromCoach: true, sentAt: data.sent_at },
    });
  } catch (err) {
    console.error("[org/messages/send]", err);
    return res.status(500).json({ error: err.message });
  }
}
