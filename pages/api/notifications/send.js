// pages/api/notifications/send.js
// Sends push notifications to one or more athletes via Expo Push API.
//
// POST {
//   athleteIds: string[]   - Supabase UUIDs or athlete_tokens
//   title:      string
//   body:       string
//   data?:      object
//   type:       string     - 'workout_assigned' | 'meal_assigned' | 'new_message' | 'class_scheduled'
// }

import { supabaseAdmin as db } from "@/lib/supabase";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { athleteIds, title, body, data = {}, type = "" } = req.body || {};

  if (!athleteIds?.length || !title || !body) {
    return res.status(400).json({ error: "athleteIds, title, and body are required" });
  }

  try {
    // Fetch push tokens - athleteIds may be UUIDs or athlete_tokens
    const looksLikeUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(athleteIds[0] || ""));

    const { data: records, error } = looksLikeUUID
      ? await db.from("athletes").select("push_token").in("id", athleteIds)
      : await db.from("athletes").select("push_token").in("athlete_token", athleteIds);

    if (error) throw error;

    const tokens = (records || [])
      .map(r => String(r.push_token || "").trim())
      .filter(t => t.startsWith("ExponentPushToken"));

    if (!tokens.length) {
      return res.status(200).json({ ok: true, sent: 0, message: "No valid push tokens found" });
    }

    const messages = tokens.map(to => ({
      to,
      title,
      body,
      data:    { ...data, type },
      sound:   "default",
      channel: type === "new_message" ? "messages" : "default",
    }));

    // Send to Expo in chunks of 100
    let totalSent = 0;
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const pushRes = await fetch(EXPO_PUSH_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(chunk),
      });
      const pushData = await pushRes.json();
      totalSent += chunk.length;
      console.log("[send-notification] Expo response:", pushData);
    }

    return res.status(200).json({ ok: true, sent: totalSent });
  } catch (err) {
    console.error("[send-notification] Error:", err);
    return res.status(500).json({ error: "Failed to send notifications" });
  }
}
