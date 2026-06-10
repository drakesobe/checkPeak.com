// pages/api/getScanById.js
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: "Missing id parameter." });
  }

  try {
    const { data: scan, error } = await db
      .from("scans")
      .select("id, scan_name, scan_date, product_name, stack_details, results_summary, banned_details, share_token, share_enabled, user_email")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!scan) return res.status(404).json({ error: "Scan not found." });

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
        // ignore bad JSON
      }
    }

    return res.status(200).json({
      scan: {
        id:             scan.id,
        name:           scan.scan_name    || null,
        date:           scan.scan_date    || null,
        productName:    scan.product_name || null,
        stackDetails:   scan.stack_details   || "",
        resultsSummary: scan.results_summary || "",
        prohibitedCount,
        limitedCount,
        otherCount,
        shareToken:   scan.share_token   || null,
        shareEnabled: Boolean(scan.share_enabled),
        userEmail:    scan.user_email    || null,
      },
    });
  } catch (err) {
    console.error("[/api/getScanById] error:", err);
    return res.status(500).json({ error: "Failed to fetch scan.", details: String(err?.message || err) });
  }
}
