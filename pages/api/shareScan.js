// pages/api/shareScan.js

import Airtable from "airtable";
import crypto from "crypto";

const scansBase =
  process.env.SCANS_API_KEY && process.env.SCANS_BASE_ID
    ? new Airtable({ apiKey: process.env.SCANS_API_KEY }).base(
        process.env.SCANS_BASE_ID
      )
    : null;

const SCANS_TABLE_NAME = process.env.SCANS_TABLE_NAME;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ error: "Method not allowed. Use POST." });
  }

  if (!scansBase || !SCANS_TABLE_NAME) {
    return res.status(500).json({
      error:
        "Scans Airtable not configured. Check SCANS_API_KEY, SCANS_BASE_ID, SCANS_TABLE_NAME.",
    });
  }

  try {
    const { scanId, enable } = req.body || {};

    if (!scanId) {
      return res
        .status(400)
        .json({ error: "Missing scanId in request body." });
    }

    if (typeof enable !== "boolean") {
      return res.status(400).json({
        error:
          "Missing or invalid 'enable' flag in request body (must be boolean).",
      });
    }

    // Load existing record
    let record;
    try {
      record = await scansBase(SCANS_TABLE_NAME).find(scanId);
    } catch (err) {
      console.error("[/api/shareScan] find error:", err);
      return res
        .status(404)
        .json({ error: "Scan not found for the given scanId." });
    }

    const fields = record.fields || {};
    let token = fields.ShareToken || "";

    // If enabling and we don't have a token, create one
    if (enable && !token) {
      try {
        token = crypto.randomBytes(16).toString("hex");
      } catch {
        token =
          Math.random().toString(36).slice(2) +
          Date.now().toString(36);
      }
    }

    const updateFields = {
      ShareEnabled: enable,          // checkbox field
      ShareToken: token,             // single line text field
      ShareDisabledAt: enable
        ? null                       // clear when turning ON
        : new Date().toISOString(),  // set when turning OFF
    };

    let updated;
    try {
      // ✅ IMPORTANT: With Airtable JS client, pass fields directly (NO { fields: ... })
      updated = await scansBase(SCANS_TABLE_NAME).update(
        scanId,
        updateFields
      );
    } catch (err) {
      console.error("[/api/shareScan] update error:", err);
      return res.status(422).json({
        error:
          err?.message ||
          "Airtable rejected the update. Check field names and types.",
      });
    }

    const updatedFields = updated.fields || {};

    return res.status(200).json({
      shareEnabled: Boolean(updatedFields.ShareEnabled),
      shareToken: updatedFields.ShareToken || token || "",
    });
  } catch (err) {
    console.error("[/api/shareScan] unexpected error:", err);
    return res.status(500).json({
      error:
        err?.message ||
        "Unexpected error while updating share settings.",
    });
  }
}
