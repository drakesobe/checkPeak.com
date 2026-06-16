// pages/api/org/remind.js
// POST { athleteId } — send a push notification reminding an athlete to complete today's workout.

import { supabaseAdmin as db } from "@/lib/supabase";
import { readUserCookie }      from "@/lib/requireUser";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

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

  const { athleteId } = req.body || {};
  if (!athleteId) return res.status(400).json({ error: "athleteId is required" });

  try {
    // Fetch push token for this athlete
    const { data: athlete, error } = await db
      .from("athletes")
      .select("push_token, name")
      .eq("id", athleteId)
      .maybeSingle();

    if (error) throw error;

    const token = String(athlete?.push_token || "").trim();
    if (!token.startsWith("ExponentPushToken")) {
      return res.status(200).json({ ok: true, sent: 0, message: "No valid push token" });
    }

    const orgName = String(user.orgName || user.OrgName || "Your coach").trim();

    const pushRes = await fetch(EXPO_PUSH_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify([{
        to:      token,
        title:   "Time to grind 💪",
        body:    `${orgName} is checking in — don't forget today's workout!`,
        data:    { type: "workout_reminder" },
        sound:   "default",
        channel: "default",
      }]),
    });

    const pushData = await pushRes.json().catch(() => ({}));
    console.log("[org/remind] Expo response:", pushData);

    return res.status(200).json({ ok: true, sent: 1 });
  } catch (err) {
    console.error("[org/remind]", err);
    return res.status(500).json({ error: err.message });
  }
}
