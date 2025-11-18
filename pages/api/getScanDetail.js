// pages/api/getScanDetail.js

import Airtable from "airtable";

const scansBase =
  process.env.SCANS_API_KEY && process.env.SCANS_BASE_ID
    ? new Airtable({ apiKey: process.env.SCANS_API_KEY }).base(
        process.env.SCANS_BASE_ID
      )
    : null;

export default async function handler(req, res) {
  // Only GET is allowed
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ error: "Method not allowed. Use GET.", ok: false });
  }

  // Basic no-cache headers
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  try {
    if (!scansBase || !process.env.SCANS_TABLE_NAME) {
      return res.status(500).json({
        ok: false,
        error:
          "Scans Airtable not configured. Check SCANS_API_KEY, SCANS_BASE_ID, SCANS_TABLE_NAME.",
      });
    }

    const { scanId } = req.query || {};
    if (!scanId) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing scanId in query string." });
    }

    // Fetch a single record by Airtable record ID (e.g. recXXXXXX)
    let record;
    try {
      record = await scansBase(process.env.SCANS_TABLE_NAME).find(scanId);
    } catch (err) {
      console.error("[getScanDetail] Airtable find error:", err);
      if (err?.statusCode === 404) {
        return res
          .status(404)
          .json({ ok: false, error: "Scan not found for that ID." });
      }
      throw err;
    }

    const f = record.fields || {};

    // Parse banned details JSON if present
    let bannedDetails = {
      ProhibitedCount: 0,
      LimitedCount: 0,
      OtherBannedCount: 0,
    };

    if (f.BannedDetails && typeof f.BannedDetails === "string") {
      try {
        const parsed = JSON.parse(f.BannedDetails);
        bannedDetails = {
          ProhibitedCount: parsed.ProhibitedCount ?? 0,
          LimitedCount: parsed.LimitedCount ?? 0,
          OtherBannedCount: parsed.OtherBannedCount ?? 0,
        };
      } catch (err) {
        console.warn(
          "[getScanDetail] Failed to parse BannedDetails JSON:",
          err
        );
      }
    }

    // Normalize shape for the frontend
    const scan = {
      id: record.id,
      name: f.ScanName || f.Name || "Unnamed Scan",
      date: f.ScanDate || null,
      stackDetails: f.StackDetails || "",
      prohibitedCount: bannedDetails.ProhibitedCount ?? 0,
      limitedCount: bannedDetails.LimitedCount ?? 0,
      otherCount: bannedDetails.OtherBannedCount ?? 0,
      // share fields (if you created these columns in Airtable)
      shareEnabled:
        typeof f.ShareEnabled === "boolean"
          ? f.ShareEnabled
          : Boolean(f.ShareEnabled),
      shareToken: f.ShareToken || null,
      // Initially empty; the detail page's "Re-analyze" button repopulates these
      matchedBanned: [],
      matchedIngredients: [],
    };

    return res.status(200).json({ ok: true, scan });
  } catch (err) {
    console.error("[getScanDetail] Unexpected error:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error in getScanDetail.",
      details: String(err?.message || err),
    });
  }
}
