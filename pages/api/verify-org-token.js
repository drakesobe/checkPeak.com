// pages/api/verify-org-token.js
// GET ?token= - verifies an org token, returns org name.

import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "Token required" });

  try {
    const { data: org, error } = await db
      .from("organizations")
      .select("id, name, token")
      .ilike("token", token)
      .maybeSingle();

    if (error) throw error;
    if (!org) return res.status(404).json({ error: "Invalid token" });

    res.status(200).json({ success: true, orgName: org.name });
  } catch (err) {
    console.error("[verify-org-token] error:", err);
    res.status(500).json({ error: "Failed to verify token" });
  }
}
