// pages/api/org/createPlanTemplate.js
import Airtable from "airtable";

/**
 * Normalize tags for SINGLE LINE TEXT Airtable field
 * Output: string (comma-separated) or ""
 */
function normalizeTagsToString(input) {
  if (!input) return "";

  if (Array.isArray(input)) {
    return input
      .map((t) => {
        if (t == null) return "";
        if (typeof t === "string") return t.trim();
        if (typeof t === "object") {
          return String(t.label || t.value || t.name || "").trim();
        }
        return String(t).trim();
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof input === "string") return input.trim();

  return String(input).trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const headerToken = req.headers["x-org-token"];

  const orgToken = String(body.token || headerToken || "").trim();
  const name = String(body.templateName || "").trim();
  const creator = String(body.createdBy || "").trim();
  const notes = String(body.notes || "").trim();
  const status = String(body.status || "Active").trim() || "Active";
  const structured = body.structured;

  // Tags is SINGLE LINE TEXT in Airtable
  const tagsText = normalizeTagsToString(body.tags);

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

    // IMPORTANT: Field names MUST match Airtable EXACTLY
    const fields = {
      Name: name,
      "Organization Token": orgToken,
      Structured: JSON.stringify(structured),
      "Created By": creator,
      Status: status,
      Notes: notes,
    };

    // Only include Tags if non-empty string
    if (tagsText) {
      fields.Tags = tagsText;
    }

    const record = await base(TABLE).create(fields);

    return res.status(200).json({
      ok: true,
      template: {
        id: record.id,
        name: record?.fields?.Name || name,
        status: record?.fields?.Status || status,
        tags: record?.fields?.Tags || "",
        orgToken: record?.fields?.["Organization Token"] || orgToken,
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
