// pages/api/deleteScan.js
// POST or DELETE { scanId | id } - deletes one of the signed-in user's scans.

import { supabaseAdmin as db } from "@/lib/supabase";
import { loadOwnedScan } from "@/lib/scanAccess";

export default async function handler(req, res) {
  if (req.method !== "DELETE" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { scanId, id } = req.body || {};
  try {
    const scan = await loadOwnedScan(req, res, scanId || id, "id");
    if (!scan) return;

    const { error } = await db.from("scans").delete().eq("id", scan.id);
    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[/api/deleteScan] error:", err);
    return res.status(500).json({ error: "Failed to delete scan." });
  }
}
