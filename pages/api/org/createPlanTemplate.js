// pages/api/org/createPlanTemplate.js
import Airtable from "airtable";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    token,
    templateName,
    createdBy = "",
    organizationName = "",
    structured,
    notes = "",
    tags = [],
    status = "Active",
  } = req.body || {};

  const orgToken = String(token || "").trim();
  const name = String(templateName || "").trim();
  const creator = String(createdBy || "").trim();

  if (!orgToken) return res.status(400).json({ error: "Missing token" });
  if (!name) return res.status(400).json({ error: "Missing templateName" });
  if (!structured || typeof structured !== "object") {
    return res.status(400).json({ error: "Missing structured plan object" });
  }

  const API_KEY = process.env.PLAN_TEMPLATES_API_KEY;
  const BASE_ID = process.env.PLAN_TEMPLATES_BASE_ID;
  const TABLE = process.env.PLAN_TEMPLATES_TABLE_NAME;

  if (!API_KEY || !BASE_ID || !TABLE) {
    return res.status(500).json({
      error:
        "PlanTemplates Airtable env vars missing. Check PLAN_TEMPLATES_API_KEY / PLAN_TEMPLATES_BASE_ID / PLAN_TEMPLATES_TABLE_NAME.",
    });
  }

  try {
    const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);

    // IMPORTANT:
    // These field names MUST match your Airtable fields exactly.
    // If you used different names, rename fields in Airtable or update these keys.
    const fields = {
      Name: name,
      "Organization Token": orgToken,
      "Organization Name": String(organizationName || "").trim(),
      Structured: JSON.stringify(structured),
      "Created By": creator,
      Status: String(status || "Active"),
      Notes: String(notes || "").trim(),
      Tags: Array.isArray(tags) ? tags : [],
    };

    const record = await base(TABLE).create(fields);

    return res.status(200).json({
      ok: true,
      template: {
        id: record.id,
        name,
      },
    });
  } catch (err) {
    console.error("[createPlanTemplate] Airtable error:", err);

    return res.status(500).json({
      error: "Failed to create plan template",
      airtable: {
        error: err?.error,
        message: err?.message,
        statusCode: err?.statusCode,
      },
    });
  }
}
