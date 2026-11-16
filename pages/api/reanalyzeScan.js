// pages/api/reanalyzeScan.js
// POST { scanId } - re-checks one of the signed-in user's saved scans against the current banned list.

import { supabaseAdmin as db } from "@/lib/supabase";
import { loadOwnedScan } from "@/lib/scanAccess";
import { checkText, getSupplementData, BANNED_LIST_MISSING } from "@/lib/supplementCheck";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  try {
    const scan = await loadOwnedScan(req, res, req.body?.scanId,
      "id, scan_name, scan_date, stack_details, share_enabled, share_token");
    if (!scan) return;

    const rawText = scan.stack_details || "";
    if (!rawText || rawText === "No ingredient text captured") {
      return res.status(400).json({ error: "This scan has no ingredient list saved, so it can't be re-checked." });
    }

    const data = await getSupplementData();
    if (!data) return res.status(503).json({ error: BANNED_LIST_MISSING });

    const { matchedBanned, matchedIngredients, bannedDetails, verdict } = checkText(rawText, data);
    const resultsSummary = `Prohibited: ${bannedDetails.ProhibitedCount}, Limited: ${bannedDetails.LimitedCount}, Other: ${bannedDetails.OtherBannedCount}`;

    const { error: updateErr } = await db.from("scans")
      .update({ banned_details: bannedDetails, results_summary: resultsSummary })
      .eq("id", scan.id);
    if (updateErr) console.error("[reanalyzeScan] update summary error:", updateErr);

    return res.status(200).json({
      scan: {
        id:              scan.id,
        name:            scan.scan_name || "Scan",
        date:            scan.scan_date || null,
        stackDetails:    rawText,
        resultsSummary,
        bannedDetails,
        verdict,
        matchedBanned,
        matchedIngredients,
        prohibitedCount: bannedDetails.ProhibitedCount,
        limitedCount:    bannedDetails.LimitedCount,
        otherCount:      bannedDetails.OtherBannedCount,
        shareEnabled:    Boolean(scan.share_enabled),
        shareToken:      scan.share_token || null,
      },
    });
  } catch (err) {
    console.error("[reanalyzeScan] unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
