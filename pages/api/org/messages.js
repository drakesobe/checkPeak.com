// pages/api/org/messages.js
// GET - returns conversation list (one entry per athlete, showing last message + unread count).

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

  const orgToken = getOrgToken(user);
  if (!orgToken) return res.status(400).json({ error: "Missing org token" });

  try {
    // Fetch all messages for this org, ordered newest first
    const { data: msgs, error } = await db
      .from("org_messages")
      .select("id, athlete_id, athlete_name, from_coach, text, read_at, sent_at")
      .eq("org_token", orgToken)
      .order("sent_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    // Group by athlete to build conversation list
    const convMap = new Map();
    for (const m of (msgs ?? [])) {
      if (!convMap.has(m.athlete_id)) {
        convMap.set(m.athlete_id, {
          id:          m.athlete_id,
          athleteName: m.athlete_name || "Athlete",
          lastMessage: m.text,
          lastAt:      m.sent_at,
          unread:      0,
        });
      }
      // Count unread (messages FROM athlete that haven't been read)
      if (!m.from_coach && !m.read_at) {
        convMap.get(m.athlete_id).unread += 1;
      }
    }

    const conversations = Array.from(convMap.values())
      .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));

    return res.status(200).json({ ok: true, conversations });
  } catch (err) {
    console.error("[org/messages]", err);
    return res.status(500).json({ error: err.message });
  }
}
