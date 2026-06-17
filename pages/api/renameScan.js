// pages/api/renameScan.js
// POST { scanId, newName } - updates scan_name in Supabase.

import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { scanId, newName } = req.body || {};
    if (!scanId || !newName || !String(newName).trim()) {
      return res.status(400).json({ error: "Missing scanId or newName in request body." });
    }

    const trimmedName = String(newName).trim();

    const { data, error } = await db
      .from("scans")
      .update({ scan_name: trimmedName })
      .eq("id", scanId)
      .select("id, scan_name")
      .single();

    if (error) throw error;

    return res.status(200).json({ scan: { id: data.id, name: data.scan_name } });
  } catch (err) {
    console.error("[renameScan] error:", err);
    return res.status(500).json({ error: "Failed to rename scan.", details: String(err?.message || err) });
  }
}
