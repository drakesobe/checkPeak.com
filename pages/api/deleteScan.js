// pages/api/deleteScan.js
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed. Use DELETE." });
  }

  const { id, userEmail } = req.body || {};
  if (!id || !userEmail) {
    return res.status(400).json({ error: "Missing id or userEmail in body." });
  }

  try {
    const { data: scan, error: fetchErr } = await db
      .from("scans")
      .select("id, user_email")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!scan) return res.status(404).json({ error: "Scan not found." });

    const ownerEmail = scan.user_email || "";
    if (ownerEmail && ownerEmail.toLowerCase().trim() !== userEmail.toLowerCase().trim()) {
      return res.status(403).json({ error: "You do not have permission to delete this scan." });
    }

    const { error: delErr } = await db.from("scans").delete().eq("id", id);
    if (delErr) throw delErr;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[/api/deleteScan] error:", err);
    return res.status(500).json({ error: "Failed to delete scan.", details: String(err?.message || err) });
  }
}
