// pages/api/deleteScan.js
import Airtable from "airtable";

const scansBase =
  process.env.SCANS_API_KEY && process.env.SCANS_BASE_ID
    ? new Airtable({ apiKey: process.env.SCANS_API_KEY }).base(
        process.env.SCANS_BASE_ID
      )
    : null;

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res
      .status(405)
      .json({ error: "Method not allowed. Use DELETE." });
  }

  if (!scansBase || !process.env.SCANS_TABLE_NAME) {
    return res.status(500).json({
      error: "Scans Airtable not configured.",
    });
  }

  const { id, userEmail } = req.body || {};
  if (!id || !userEmail) {
    return res
      .status(400)
      .json({ error: "Missing id or userEmail in body." });
  }

  try {
    const record = await scansBase(process.env.SCANS_TABLE_NAME).find(id);
    const f = record.fields || {};
    const ownerEmail = f.UserEmail || "";

    if (
      ownerEmail &&
      ownerEmail.toLowerCase().trim() !== userEmail.toLowerCase().trim()
    ) {
      return res
        .status(403)
        .json({ error: "You do not have permission to delete this scan." });
    }

    await scansBase(process.env.SCANS_TABLE_NAME).destroy(record.id);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[/api/deleteScan] error:", err);
    return res.status(500).json({
      error: "Failed to delete scan.",
      details: String(err?.message || err),
    });
  }
}
