// pages/api/update-organization.js
import Airtable from "airtable";

function pickString(v) {
  return String(v ?? "").trim();
}

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const ORGANIZATIONS_API_KEY = process.env.ORGANIZATIONS_API_KEY;
    const ORGANIZATIONS_BASE_ID = process.env.ORGANIZATIONS_BASE_ID;
    const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME;

    if (!ORGANIZATIONS_API_KEY || !ORGANIZATIONS_BASE_ID || !ORGANIZATIONS_TABLE_NAME) {
      return res.status(500).json({
        error:
          "Organizations Airtable not configured. Check ORGANIZATIONS_API_KEY, ORGANIZATIONS_BASE_ID, ORGANIZATIONS_TABLE_NAME.",
      });
    }

    const { organizationId, updates } = req.body || {};
    const id = pickString(organizationId);
    const u = updates && typeof updates === "object" ? updates : null;

    if (!id) return res.status(400).json({ error: "organizationId is required." });
    if (!u) return res.status(400).json({ error: "updates object is required." });

    // ✅ allowlist only (prevents Token/Password writes)
    const fields = {};

    if (u.Name !== undefined) fields["Name"] = pickString(u.Name);

    if (u.Email !== undefined) {
      const e = normEmail(u.Email);
      if (!e || !e.includes("@")) return res.status(400).json({ error: "Enter a valid email." });
      fields["Email"] = e;
    }

    // ✅ Airtable column is literally "Phone Number"
    if (u["Phone Number"] !== undefined) fields["Phone Number"] = pickString(u["Phone Number"]);

    if (!Object.keys(fields).length) {
      return res.status(400).json({ error: "No valid fields to update." });
    }

    const base = new Airtable({ apiKey: ORGANIZATIONS_API_KEY }).base(ORGANIZATIONS_BASE_ID);

    const updated = await base(ORGANIZATIONS_TABLE_NAME).update([
      { id, fields },
    ]);

    return res.status(200).json({
      ok: true,
      organization: { id: updated?.[0]?.id, ...(updated?.[0]?.fields || {}) },
    });
  } catch (err) {
    console.error("[update-organization] error:", err);
    return res.status(500).json({
      error: "Failed to update organization.",
      details: err?.message,
      airtable: {
        statusCode: err?.statusCode,
        message: err?.message,
        error: err?.error,
      },
    });
  }
}
