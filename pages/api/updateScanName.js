// pages/api/updateScanName.js
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.SCANS_API_KEY }).base(
  process.env.SCANS_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { recordId, newName } = req.body || {};

    if (!recordId || !newName || !newName.trim()) {
      return res
        .status(400)
        .json({ error: "Missing or invalid recordId / newName" });
    }

    const tableName = process.env.SCANS_TABLE_NAME || "Scans";

    const updatedRecords = await base(tableName).update([
      {
        id: recordId,
        fields: {
          ScanName: newName.trim(),
        },
      },
    ]);

    const updated = updatedRecords[0];

    return res.status(200).json({
      success: true,
      message: "Scan name updated successfully",
      scan: {
        id: updated.id,
        name: updated.get("ScanName"),
      },
    });
  } catch (error) {
    console.error("❌ Error updating scan name:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to update scan name",
    });
  }
}
