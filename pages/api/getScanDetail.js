// pages/api/getScanDetail.js
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET.", ok: false });
  }

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const { scanId } = req.query || {};
  if (!scanId) {
    return res.status(400).json({ ok: false, error: "Missing scanId in query string." });
  }

  try {
    const { data: scan, error } = await db
      .from("scans")
      .select("id, scan_name, scan_date, stack_details, banned_details, share_enabled, share_token")
      .eq("id", scanId)
      .maybeSingle();

    if (error) throw error;
    if (!scan) {
      return res.status(404).json({ ok: false, error: "Scan not found for that ID." });
    }

    let bannedDetails = { ProhibitedCount: 0, LimitedCount: 0, OtherBannedCount: 0 };
    if (scan.banned_details) {
      try {
        const parsed = typeof scan.banned_details === "string"
          ? JSON.parse(scan.banned_details)
          : scan.banned_details;
        bannedDetails = {
          ProhibitedCount:  parsed.ProhibitedCount  ?? 0,
          LimitedCount:     parsed.LimitedCount     ?? 0,
          OtherBannedCount: parsed.OtherBannedCount ?? 0,
        };
      } catch (err) {
        console.warn("[getScanDetail] Failed to parse banned_details:", err);
      }
    }

    return res.status(200).json({
      ok: true,
      scan: {
        id:              scan.id,
        name:            scan.scan_name || "Unnamed Scan",
        date:            scan.scan_date || null,
        stackDetails:    scan.stack_details || "",
        prohibitedCount: bannedDetails.ProhibitedCount,
        limitedCount:    bannedDetails.LimitedCount,
        otherCount:      bannedDetails.OtherBannedCount,
        shareEnabled:    Boolean(scan.share_enabled),
        shareToken:      scan.share_token || null,
        matchedBanned:      [],
        matchedIngredients: [],
      },
    });
  } catch (err) {
    console.error("[getScanDetail] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error in getScanDetail.", details: String(err?.message || err) });
  }
}
