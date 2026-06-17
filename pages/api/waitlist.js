// pages/api/waitlist.js
// POST { email, name?, role?, organization?, source? } - adds an early-access signup.

import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email, name, source, role, organization } = req.body || {};

    if (!email || !String(email).includes("@")) {
      return res.status(400).json({ error: "Valid email is required." });
    }

    const safeEmail = String(email).trim().toLowerCase();

    // Don't duplicate
    const { data: existing } = await db
      .from("athletes")
      .select("id")
      .eq("email", safeEmail)
      .maybeSingle();

    if (existing) return res.status(200).json({ success: true });

    const { error } = await db.from("athletes").insert({
      email:        safeEmail,
      name:         (name         || "").trim() || null,
      organization: (organization || "").trim() || null,
      source:       (source       || "homepage-request-access").trim(),
      type:         "EarlyAccess",
      created_at:   new Date().toISOString(),
    });

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[waitlist] error:", err);
    return res.status(500).json({ error: "Failed to submit request. Please try again." });
  }
}
