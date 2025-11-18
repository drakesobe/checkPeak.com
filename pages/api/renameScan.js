// pages/api/renameScan.js

import Airtable from "airtable";

/**
 * Rename a scan.
 *
 * POST { scanId, newName }
 *
 * Updates ScanName field in Scans table.
 */

const scansBase =
  process.env.SCANS_API_KEY && process.env.SCANS_BASE_ID
    ? new Airtable({ apiKey: process.env.SCANS_API_KEY }).base(
        process.env.SCANS_BASE_ID
      )
    : null;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ error: "Method not allowed. Use POST." });
  }

  if (!scansBase || !process.env.SCANS_TABLE_NAME) {
    return res.status(500).json({
      error: "Scans Airtable not configured.",
    });
  }

  try {
    const { scanId, newName } = req.body || {};
    if (!scanId || !newName || !String(newName).trim()) {
      return res.status(400).json({
        error: "Missing scanId or newName in request body.",
      });
    }

    const trimmedName = String(newName).trim();

    const updated = await scansBase(process.env.SCANS_TABLE_NAME).update(
      scanId,
      {
        ScanName: trimmedName,
      }
    );

    const scanObj = {
      id: updated.id,
      name: updated.fields?.ScanName || trimmedName,
    };

    return res.status(200).json({ scan: scanObj });
  } catch (err) {
    console.error("[renameScan] error:", err);
    return res.status(500).json({
      error: "Failed to rename scan.",
      details: String(err?.message || err),
    });
  }
}
