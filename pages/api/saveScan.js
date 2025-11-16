// pages/api/saveScan.js
import Airtable from "airtable";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      userEmail,
      stackDetails,
      resultSummary,
      scanId,
      bannedDetails, // from /api/check
    } = req.body;

    if (!userEmail) {
      console.error("❌ Missing userEmail in request body");
      return res.status(400).json({ error: "Missing userEmail" });
    }

    const scanDate = new Date();

    const recordPayload = {
      UserEmail: userEmail,
      ScanName: `Scan - ${scanDate.toLocaleString("en-US", { hour12: false })}`,
      ScanDate: scanDate.toISOString(),
      StackDetails: stackDetails || "No stack details provided",
      ResultsSummary: resultSummary || "No summary available",
      ID: scanId || `scan-${Date.now()}`,
      BannedDetails: bannedDetails ? JSON.stringify(bannedDetails) : null,
    };

    console.log("🚀 Preparing to save scan record to Airtable:");
    console.log(JSON.stringify(recordPayload, null, 2));

    const base = new Airtable({ apiKey: process.env.SCANS_API_KEY }).base(
      process.env.SCANS_BASE_ID
    );
    const tableName = process.env.SCANS_TABLE_NAME || "Scans";

    const createdRecord = await base(tableName).create([
      {
        fields: recordPayload,
      },
    ]);

    console.log("✅ Airtable save success:", createdRecord);

    res.status(200).json({
      success: true,
      message: "Scan saved successfully",
      recordId: createdRecord[0].id,
    });
  } catch (error) {
    console.error("❌ Error saving scan:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Unknown error while saving scan",
    });
  }
}
