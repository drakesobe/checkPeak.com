// pages/api/getSharedScan.js
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: "Missing token parameter." });
  }

  try {
    const { data: scan, error } = await db
      .from("scans")
      .select("id, scan_name, scan_date, product_name, stack_details, banned_details, share_enabled")
      .eq("share_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!scan) return res.status(404).json({ error: "Shared scan not found." });
    if (!scan.share_enabled) return res.status(403).json({ error: "Sharing disabled for this scan." });

    let bannedDetails = null;
    let prohibitedCount = 0;
    let limitedCount = 0;
    let otherCount = 0;

    if (scan.banned_details) {
      try {
        bannedDetails = typeof scan.banned_details === "string"
          ? JSON.parse(scan.banned_details)
          : scan.banned_details;
        prohibitedCount = bannedDetails.ProhibitedCount  || 0;
        limitedCount    = bannedDetails.LimitedCount     || 0;
        otherCount      = bannedDetails.OtherBannedCount || 0;
      } catch {
        // ignore
      }
    }

    return res.status(200).json({
      scan: {
        id:             scan.id,
        name:           scan.scan_name    || null,
        date:           scan.scan_date    || null,
        productName:    scan.product_name || null,
        stackDetails:   scan.stack_details || "",
        prohibitedCount,
        limitedCount,
        otherCount,
      },
    });
  } catch (err) {
    console.error("[/api/getSharedScan] error:", err);
    return res.status(500).json({ error: "Failed to fetch shared scan.", details: String(err?.message || err) });
  }
}
