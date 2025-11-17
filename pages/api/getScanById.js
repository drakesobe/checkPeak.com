// pages/api/getScanById.js
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

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: "Missing id parameter." });
  }

  try {
    const record = await scansBase(process.env.SCANS_TABLE_NAME).find(id);

    const f = record.fields || {};
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
        // ignore bad JSON
      }
    }

    const scan = {
      id: record.id,
      name: f.ScanName || f.Name || null,
      date: f.ScanDate || null,
      productName: f.ProductName || null,
      stackDetails: f.StackDetails || "",
      resultsSummary: f.ResultsSummary || "",
      prohibitedCount,
      limitedCount,
      otherCount,
    };

    return res.status(200).json({ scan });
  } catch (err) {
    console.error("[/api/getScanById] error:", err);
    if (err?.statusCode === 404) {
      return res.status(404).json({ error: "Scan not found." });
    }
    return res.status(500).json({
      error: "Failed to fetch scan.",
      details: String(err?.message || err),
    });
  }
}
