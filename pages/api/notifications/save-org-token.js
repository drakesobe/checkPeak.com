// pages/api/notifications/save-org-token.js
// Saves an Expo push token for an org/coach user.
// POST { orgId, token }
// Requires: organizations table to have a push_token column.
// Migration: ALTER TABLE organizations ADD COLUMN IF NOT EXISTS push_token TEXT;

import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { orgId, token } = req.body || {};

  if (!orgId || !token) {
    return res.status(400).json({ error: "orgId and token are required" });
  }

  try {
    const { error } = await db
      .from("organizations")
      .update({ push_token: token })
      .eq("id", orgId);

    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[save-org-token] Error:", err);
    return res.status(500).json({ error: "Failed to save org push token" });
  }
}
