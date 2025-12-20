// pages/api/org/deletePlanTemplate.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

/**
 * Deletes a plan template record by ID, but ONLY if it belongs to the logged-in org.
 *
 * Security:
 * - Uses requireOrg(req) cookie auth
 * - Verifies the record's "Organization Token" matches org.token before deleting
 *
 * Request:
 * - Method: DELETE
 * - Body: { templateId: "recXXXX" }  (also supports query ?templateId=)
 */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = requireOrg(req);
  if (!auth.ok) {
    return res.status(401).json({ error: auth.error });
  }

  const { org } = auth;

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const templateId = String(body.templateId || req.query?.templateId || "").trim();

  if (!templateId) {
    return res.status(400).json({ error: "Missing templateId" });
  }

  const API_KEY = process.env.PLAN_TEMPLATES_API_KEY;
  const BASE_ID = process.env.PLAN_TEMPLATES_BASE_ID;
  const TABLE = process.env.PLAN_TEMPLATES_TABLE_NAME;

  if (!API_KEY || !BASE_ID || !TABLE) {
    return res.status(500).json({
      error:
        "PlanTemplates Airtable env vars missing. Check PLAN_TEMPLATES_API_KEY / PLAN_TEMPLATES_BASE_ID / PLAN_TEMPLATES_TABLE_NAME.",
      missing: {
        PLAN_TEMPLATES_API_KEY: !API_KEY,
        PLAN_TEMPLATES_BASE_ID: !BASE_ID,
        PLAN_TEMPLATES_TABLE_NAME: !TABLE,
      },
    });
  }

  try {
    const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);

    // 1) Fetch record to verify ownership
    const record = await base(TABLE).find(templateId);
    const tokenOnRecord = String(record?.fields?.["Organization Token"] || "").trim();

    if (!tokenOnRecord) {
      return res.status(400).json({
        error: 'Template record is missing "Organization Token". Cannot safely delete.',
      });
    }

    if (tokenOnRecord !== String(org?.token || "").trim()) {
      return res.status(403).json({
        error: "Forbidden: template does not belong to your organization.",
      });
    }

    // 2) Delete
    await base(TABLE).destroy(templateId);

    return res.status(200).json({ ok: true, deleted: { id: templateId } });
  } catch (err) {
    console.error("[deletePlanTemplate] Airtable error:", err);
    return res.status(500).json({
      error: "Failed to delete plan template",
      airtable: {
        error: err?.error,
        message: err?.message,
        statusCode: err?.statusCode,
      },
    });
  }
}
