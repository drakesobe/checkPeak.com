// pages/api/updateScanName.js
// POST { recordId, newName } - updates scan_name in Supabase.

import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { recordId, newName } = req.body || {};
    if (!recordId || !newName || !newName.trim()) {
      return res.status(400).json({ error: "Missing or invalid recordId / newName" });
    }

    const { data, error } = await db
      .from("scans")
      .update({ scan_name: newName.trim() })
      .eq("id", recordId)
      .select("id, scan_name")
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Scan name updated successfully",
      scan: { id: data.id, name: data.scan_name },
    });
  } catch (error) {
    console.error("❌ Error updating scan name:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to update scan name" });
  }
}
