// lib/sendNotification.js
// Server-side push notification helper — calls Expo Push API directly.
// Fire-and-forget: never throws; caller doesn't need to await.

import { supabaseAdmin as db } from "@/lib/supabase";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Send push notifications to one or more athletes.
 *
 * @param {string[]} athleteTokens  - Array of athlete_token strings (ATH-...)
 * @param {{ title: string; body: string; data?: object; type?: string }} payload
 */
export async function sendNotification(athleteTokens, { title, body, data = {}, type = "" }) {
  if (!athleteTokens?.length || !title || !body) return;

  try {
    const { data: records } = await db
      .from("athletes")
      .select("push_token")
      .in("athlete_token", athleteTokens);

    const tokens = (records || [])
      .map(r => String(r.push_token || "").trim())
      .filter(t => t.startsWith("ExponentPushToken"));

    if (!tokens.length) return;

    const channel = type === "new_message" ? "messages" : "default";
    const messages = tokens.map(to => ({ to, title, body, data: { ...data, type }, sound: "default", channel }));

    // Send in chunks of 100 (Expo limit)
    for (let i = 0; i < messages.length; i += 100) {
      fetch(EXPO_PUSH_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(messages.slice(i, i + 100)),
      }).catch(() => {});
    }
  } catch {}
}

/**
 * Send to athletes looked up by their Supabase UUID instead of athlete_token.
 */
export async function sendNotificationByIds(athleteIds, payload) {
  if (!athleteIds?.length) return;
  try {
    const { data: records } = await db
      .from("athletes")
      .select("athlete_token")
      .in("id", athleteIds);
    const tokens = (records || []).map(r => r.athlete_token).filter(Boolean);
    return sendNotification(tokens, payload);
  } catch {}
}
