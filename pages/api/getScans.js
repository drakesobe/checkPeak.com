// pages/api/getScans.js
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.SCANS_API_KEY }).base(
  process.env.SCANS_BASE_ID
);

export default async function handler(req, res) {
  const { userEmail } = req.query;

  if (!userEmail) {
    return res.status(400).json({ error: "Missing userEmail" });
  }

  try {
    const tableName = process.env.SCANS_TABLE_NAME || "Scans";

    // Simple email sanitization for filterByFormula (escape single quotes)
    const safeEmail = String(userEmail).replace(/'/g, "\\'");

    const records = await base(tableName)
      .select({
        filterByFormula: `{UserEmail}='${safeEmail}'`,
        sort: [{ field: "ScanDate", direction: "desc" }],
      })
      .firstPage();

    const scans = records.map((record) => ({
      id: record.id,
      name: record.get("ScanName"),
      date: record.get("ScanDate"),
      summary: record.get("ResultsSummary") || "",
      stackDetails: record.get("StackDetails") || "",
      bannedDetails: record.get("BannedDetails") || null, // JSON string or null
    }));

    res.status(200).json({ scans });
  } catch (error) {
    console.error("❌ Error fetching scans from Airtable:", error);
    res.status(500).json({ error: "Failed to fetch scans from Airtable" });
  }
}
