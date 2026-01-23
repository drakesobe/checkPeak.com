// pages/api/org/getPlanTemplates.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

function escapeAirtableString(str = "") {
  // Airtable formula strings are quoted; escape single quotes for safety.
  return String(str).replace(/'/g, "\\'");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const API_KEY = process.env.PLAN_TEMPLATES_API_KEY;
  const BASE_ID = process.env.PLAN_TEMPLATES_BASE_ID;
  const TABLE = process.env.PLAN_TEMPLATES_TABLE_NAME;

  if (!API_KEY || !BASE_ID || !TABLE) {
    return res.status(500).json({
      error: "PlanTemplates Airtable env vars missing.",
      missing: {
        PLAN_TEMPLATES_API_KEY: !API_KEY,
        PLAN_TEMPLATES_BASE_ID: !BASE_ID,
        PLAN_TEMPLATES_TABLE_NAME: !TABLE,
      },
      debug: { cwd: process.cwd() },
    });
  }

  // ✅ Preferred: cookie auth (Organization/Admin/Trainer)
  const auth = requireOrg(req);

  // Legacy fallback: token can come from header or query (?token=)
  const headerToken = req.headers["x-org-token"];
  const queryToken = req.query?.token;

  const cookieToken = auth?.ok ? String(auth?.org?.token || "").trim() : "";
  const fallbackToken = String(headerToken || queryToken || "").trim();

  const orgToken = cookieToken || fallbackToken;

  if (!orgToken) {
    return res.status(401).json({
      error:
        "Missing organization token. Log in (cookie auth) or provide x-org-token / ?token= for legacy.",
      debug: {
        hasCookieAuth: Boolean(auth?.ok),
        hasHeaderToken: Boolean(headerToken),
        hasQueryToken: Boolean(queryToken),
      },
    });
  }

  const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);

  // Token field name candidates (Airtable is case-sensitive)
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

  const pickField = (fieldsObj, candidates) => {
    for (const key of candidates) {
      if (fieldsObj && Object.prototype.hasOwnProperty.call(fieldsObj, key)) return key;
    }
    return null;
  };

  const mapTemplates = (records) =>
    records.map((r) => {
      const f = r.fields || {};

      const nameKey = pickField(f, NAME_FIELDS);
      const structuredKey = pickField(f, STRUCT_FIELDS);
      const createdByKey = pickField(f, CREATED_BY_FIELDS);
      const statusKey = pickField(f, STATUS_FIELDS);
      const notesKey = pickField(f, NOTES_FIELDS);
      const tagsKey = pickField(f, TAGS_FIELDS);

      let structured = null;
      try {
        structured = structuredKey && f[structuredKey] ? JSON.parse(f[structuredKey]) : null;
      } catch {
        structured = null;
      }

      // Tags could be single-line text OR multi-select OR array depending on your Airtable field type
      const tagsRaw = tagsKey ? f[tagsKey] : [];
      const tags =
        Array.isArray(tagsRaw)
          ? tagsRaw
          : typeof tagsRaw === "string"
          ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
          : [];

      return {
        id: r.id,
        name: nameKey ? f[nameKey] : "Template",
        structured,
        createdBy: createdByKey ? f[createdByKey] : "",
        status: statusKey ? f[statusKey] : "Active",
        notes: notesKey ? f[notesKey] : "",
        tags,
        createdAt: f["Created At"] || f["CreatedAt"] || r.createdTime || "",
        _debug_fieldKeys: Object.keys(f),
      };
    });

  const safeToken = escapeAirtableString(orgToken);

  // 1) Attempt filtered query using any matching org token field name
  for (const tokenField of ORG_TOKEN_FIELDS) {
    try {
      const formula = `{${tokenField}}='${safeToken}'`;

      const records = await base(TABLE)
        .select({
          filterByFormula: formula,
          pageSize: 50,
        })
        .all();

      return res.status(200).json({
        ok: true,
        tokenFieldUsed: tokenField,
        authMode: cookieToken ? "cookie" : "token",
        templates: mapTemplates(records),
      });
    } catch (err) {
      const msg = String(err?.message || "");
      const isFieldNameIssue =
        msg.toLowerCase().includes("unknown field name") ||
        msg.toLowerCase().includes("invalid filterbyformula") ||
        msg.toLowerCase().includes("formula");

      if (!isFieldNameIssue) {
        return res.status(500).json({
          error: "Airtable request failed (non-formula error)",
          airtable: {
            message: err?.message,
            statusCode: err?.statusCode,
            error: err?.error,
          },
          debug: {
            triedTokenField: tokenField,
          },
        });
      }
      // try next token field name
    }
  }

  // 2) Fallback: fetch without filter so you can confirm table access + see actual fields
  try {
    const records = await base(TABLE)
      .select({
        maxRecords: 50,
        pageSize: 50,
      })
      .all();

    return res.status(200).json({
      ok: true,
      tokenFieldUsed: null,
      authMode: cookieToken ? "cookie" : "token",
      warning:
        "Could not filter by org token (field name mismatch). Returned unfiltered templates to reveal actual Airtable field names.",
      templates: mapTemplates(records),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Airtable request failed (fallback unfiltered)",
      airtable: {
        message: err?.message,
        statusCode: err?.statusCode,
        error: err?.error,
      },
    });
  }
}
