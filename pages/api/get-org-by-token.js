// pages/api/get-org-by-token.js
// GET ?token= — returns org name for a given org token.

import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { token } = req.query;
  if (!token) return res.status(400).json({ success: false, error: "Token is required" });

  try {
    const { data: org, error } = await db
      .from("organizations")
      .select("id, name, token")
      .ilike("token", token)
      .maybeSingle();

    if (error) throw error;
    if (!org) return res.status(404).json({ success: false, error: "Organization not found" });

    res.status(200).json({ success: true, organization: org.name });
  } catch (err) {
    console.error("[get-org-by-token] error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch organization" });
  }
}
