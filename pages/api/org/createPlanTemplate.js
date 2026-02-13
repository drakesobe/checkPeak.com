// pages/api/org/createPlanTemplate.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

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
        if (typeof t === "object") return String(t.label || t.value || t.name || "").trim();
        return String(t).trim();
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof input === "string") return input.trim();
  return String(input).trim();
}

function asString(v) {
  return String(v ?? "").trim();
}

function safeJson(res, code, obj) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(code).json(obj);
}

// Candidate field names (Airtable is case-sensitive)
const ORG_TOKEN_FIELDS = [
  "Organization Token",
  "Org Token",
  "Token",
  "OrganizationToken",
  "OrgToken",
];

const NAME_FIELDS = ["Name", "Template Name", "TemplateName"];
const STRUCT_FIELDS = ["Structured", "Structured JSON", "StructuredJSON", "JSON"];
const CREATED_BY_FIELDS = ["Created By", "CreatedBy", "Creator", "Owner"];
const STATUS_FIELDS = ["Status", "Template Status", "TemplateStatus"];
const NOTES_FIELDS = ["Notes", "Template Notes", "TemplateNotes"];
const TAGS_FIELDS = ["Tags", "Template Tags", "TemplateTags"];

// For CREATE, we will WRITE to the first option in each list that exists in the table.
// To learn actual fields, we fetch 1 record (or table schema via records).
function pickField(fieldsObj, candidates) {
  for (const key of candidates) {
    if (fieldsObj && Object.prototype.hasOwnProperty.call(fieldsObj, key)) return key;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return safeJson(res, 405, { error: "Method not allowed" });

  const API_KEY = process.env.PLAN_TEMPLATES_API_KEY;
  const BASE_ID = process.env.PLAN_TEMPLATES_BASE_ID;
  const TABLE = process.env.PLAN_TEMPLATES_TABLE_NAME;

  if (!API_KEY || !BASE_ID || !TABLE) {
    return safeJson(res, 500, {
      error:
        "PlanTemplates Airtable env vars missing. Check PLAN_TEMPLATES_API_KEY / PLAN_TEMPLATES_BASE_ID / PLAN_TEMPLATES_TABLE_NAME.",
      missing: {
        PLAN_TEMPLATES_API_KEY: !API_KEY,
        PLAN_TEMPLATES_BASE_ID: !BASE_ID,
        PLAN_TEMPLATES_TABLE_NAME: !TABLE,
      },
    });
  }

  // ✅ cookie auth preferred
  const auth = requireOrg(req);

  // Legacy fallback: token from header/body (keeps backwards compatibility)
  const headerToken = asString(req.headers["x-org-token"]);
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const bodyToken = asString(body.token);

  const cookieToken = auth?.ok ? asString(auth?.org?.token || auth?.org?.Token || "") : "";
  const orgToken = cookieToken || headerToken || bodyToken;

  if (!orgToken) {
    return safeJson(res, 401, {
      error:
        "Missing organization token. Log in (cookie auth) or provide x-org-token / body.token for legacy.",
      debug: {
        hasCookieAuth: Boolean(auth?.ok),
        hasHeaderToken: Boolean(headerToken),
        hasBodyToken: Boolean(bodyToken),
      },
    });
  }

  const name = asString(body.templateName);
  const creator = asString(body.createdBy);
  const notes = asString(body.notes);
  const status = asString(body.status || "Active") || "Active";
  const structured = body.structured;

  const tagsText = normalizeTagsToString(body.tags);

  if (!name) return safeJson(res, 400, { error: "Missing templateName" });
  if (!structured || typeof structured !== "object") {
    return safeJson(res, 400, { error: "Missing structured plan object" });
  }

  try {
    const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);

    // 🔎 Fetch 1 record to infer actual column names (handles schema differences safely)
    // If table is empty, we fall back to the default “most likely” names.
    let fieldKeys = [];
    try {
      const sample = await base(TABLE).select({ maxRecords: 1 }).firstPage();
      fieldKeys = Object.keys(sample?.[0]?.fields || {});
    } catch {
      fieldKeys = [];
    }

    const sampleFieldsObj = {};
    for (const k of fieldKeys) sampleFieldsObj[k] = true;

    const tokenKey = pickField(sampleFieldsObj, ORG_TOKEN_FIELDS) || "Organization Token";
    const nameKey = pickField(sampleFieldsObj, NAME_FIELDS) || "Name";
    const structKey = pickField(sampleFieldsObj, STRUCT_FIELDS) || "Structured";
    const createdByKey = pickField(sampleFieldsObj, CREATED_BY_FIELDS) || "Created By";
    const statusKey = pickField(sampleFieldsObj, STATUS_FIELDS) || "Status";
    const notesKey = pickField(sampleFieldsObj, NOTES_FIELDS) || "Notes";
    const tagsKey = pickField(sampleFieldsObj, TAGS_FIELDS) || "Tags";

    const fields = {
      [nameKey]: name,
      [tokenKey]: orgToken,
      [structKey]: JSON.stringify(structured),
      [createdByKey]: creator,
      [statusKey]: status,
      [notesKey]: notes,
    };

    if (tagsText) fields[tagsKey] = tagsText;

    const record = await base(TABLE).create(fields);

    return safeJson(res, 200, {
      ok: true,
      template: {
        id: record.id,
        name: record?.fields?.[nameKey] || name,
        status: record?.fields?.[statusKey] || status,
        tags: record?.fields?.[tagsKey] || "",
        orgToken: record?.fields?.[tokenKey] || orgToken,
      },
      debug: {
        authMode: cookieToken ? "cookie" : "token",
        keysUsed: { tokenKey, nameKey, structKey, createdByKey, statusKey, notesKey, tagsKey },
      },
    });
  } catch (err) {
    console.error("[createPlanTemplate] Airtable error:", err);
    return safeJson(res, 500, {
      error: "Failed to create plan template",
      airtable: {
        error: err?.error,
        message: err?.message,
        statusCode: err?.statusCode,
      },
    });
  }
}
