// pages/api/getSharedScan.js
import Airtable from "airtable";

const scansBase =
  process.env.SCANS_API_KEY && process.env.SCANS_BASE_ID
    ? new Airtable({ apiKey: process.env.SCANS_API_KEY }).base(
        process.env.SCANS_BASE_ID
      )
    : null;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ error: "Method not allowed. Use GET." });
  }

  if (!scansBase || !process.env.SCANS_TABLE_NAME) {
    return res.status(500).json({
      error: "Scans Airtable not configured.",
    });
  }

  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: "Missing token parameter." });
  }

  try {
    const records = await scansBase(process.env.SCANS_TABLE_NAME)
      .select({
        maxRecords: 1,
        filterByFormula: `{ShareToken} = '${token}'`,
      })
      .firstPage();

    if (!records || !records.length) {
      return res.status(404).json({ error: "Shared scan not found." });
    }

    const record = records[0];
    const f = record.fields || {};

    if (!f.ShareEnabled) {
      return res.status(403).json({ error: "Sharing disabled for this scan." });
    }

    let bannedDetails = null;
    let prohibitedCount = 0;
    let limitedCount = 0;
    let otherCount = 0;

    if (f.BannedDetails) {
      try {
        bannedDetails =
          typeof f.BannedDetails === "string"
            ? JSON.parse(f.BannedDetails)
            : f.BannedDetails;
        prohibitedCount = bannedDetails.ProhibitedCount || 0;
        limitedCount = bannedDetails.LimitedCount || 0;
        otherCount = bannedDetails.OtherBannedCount || 0;
      } catch {
        // ignore
      }
    }

    const scan = {
      id: record.id,
      name: f.ScanName || f.Name || null,
      date: f.ScanDate || null,
      productName: f.ProductName || null,
      stackDetails: f.StackDetails || "",
      prohibitedCount,
      limitedCount,
      otherCount,
    };

    return res.status(200).json({ scan });
  } catch (err) {
    console.error("[/api/getSharedScan] error:", err);
    return res.status(500).json({
      error: "Failed to fetch shared scan.",
      details: String(err?.message || err),
    });
  }
}
