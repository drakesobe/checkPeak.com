// pages/api/saveScan.js
import Airtable from "airtable";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userEmail, stackDetails, resultSummary, scanId } = req.body;

    if (!userEmail) {
      console.error("❌ Missing userEmail in request body");
      return res.status(400).json({ error: "Missing userEmail" });
    }

    // Build the record payload for Airtable
    const recordPayload = {
      UserEmail: userEmail,
      ScanName: `Scan - ${new Date().toLocaleString("en-US", { hour12: false })}`,
      ScanDate: new Date().toISOString(), // ✅ ISO string works for Date + Time field in Airtable
      StackDetails: stackDetails || "No stack details provided",
      ResultsSummary: resultSummary || "No summary available", // ✅ fixed typo (was ResultsSumary)
      ID: scanId || `scan-${Date.now()}`,
    };

    // Debug log payload before sending
    console.log("🚀 Preparing to save scan record to Airtable:");
    console.log(JSON.stringify(recordPayload, null, 2));

    // Use SCANS env vars (matches your .env.local)
    const base = new Airtable({ apiKey: process.env.SCANS_API_KEY }).base(
      process.env.SCANS_BASE_ID
    );

    // Use table name from env too
    const tableName = process.env.SCANS_TABLE_NAME || "Scans";

    // Attempt to save to Airtable
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
    res.status(400).json({
      success: false,
      error: error.message || "Unknown error while saving scan",
    });
  }
}
