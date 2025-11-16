// pages/api/getScanById.js
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.SCANS_API_KEY }).base(
  process.env.SCANS_BASE_ID
);

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) return res.status(400).json({ error: "Missing scan ID" });

  try {
    const tableName = process.env.SCANS_TABLE_NAME || "Scans";

    const record = await base(tableName).find(id);

    const prohibitedCount = Number(record.get("ProhibitedCount") || 0);
    const limitedCount = Number(record.get("LimitedCount") || 0);
    const otherCount =
      Number(record.get("OtherBannedCount") || record.get("OtherCount") || 0);

    let riskLevel = "safe";
    if (prohibitedCount > 0) riskLevel = "prohibited";
    else if (limitedCount > 0 || otherCount > 0) riskLevel = "limited";

    const scan = {
      id: record.id,
      name: record.get("ScanName") || "Unnamed Scan",
      date: record.get("ScanDate") || null,
      summary:
        record.get("ResultsSummary") ||
        record.get("ResultSummary") ||
        "",
      stackDetails: record.get("StackDetails") || "",
      prohibitedCount,
      limitedCount,
      otherCount,
      riskLevel,
    };

    res.status(200).json({ scan });
  } catch (error) {
    console.error("❌ getScanById error:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch scan from Airtable" });
  }
}
