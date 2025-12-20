import Airtable from "airtable";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const API_KEY = process.env.PLAN_TEMPLATES_API_KEY;
  const BASE_ID = process.env.PLAN_TEMPLATES_BASE_ID;
  const TABLE = process.env.PLAN_TEMPLATES_TABLE_NAME;

  if (!API_KEY || !BASE_ID || !TABLE) {
    return res.status(500).json({
      error: "PlanTemplates Airtable env vars missing.",
      debug: {
        has_API_KEY: Boolean(API_KEY),
        has_BASE_ID: Boolean(BASE_ID),
        has_TABLE: Boolean(TABLE),
        cwd: process.cwd(),
      },
    });
  }

  // token can come from header OR query (?token=)
  const headerToken = req.headers["x-org-token"];
  const queryToken = req.query?.token;
  const orgToken = String(headerToken || queryToken || "").trim();

  if (!orgToken) return res.status(400).json({ error: "Missing token" });

  const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);

  // We try these field names in order (because Airtable is case-sensitive)
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
        structured = f[structuredKey] ? JSON.parse(f[structuredKey]) : null;
      } catch {
        structured = null;
      }

      return {
        id: r.id,
        name: nameKey ? f[nameKey] : "Template",
        structured,
        createdBy: createdByKey ? f[createdByKey] : "",
        status: statusKey ? f[statusKey] : "Active",
        notes: notesKey ? f[notesKey] : "",
        tags: tagsKey ? f[tagsKey] : [],
        createdAt: f["Created At"] || r.createdTime || "",
        // helpful for debugging field names:
        _debug_fieldKeys: Object.keys(f),
      };
    });

  // 1) Attempt filtered query using any matching org token field name
  for (const tokenField of ORG_TOKEN_FIELDS) {
    try {
      const records = await base(TABLE)
        .select({
          filterByFormula: `{${tokenField}} = "${orgToken}"`,
          pageSize: 50,
        })
        .all();

      return res.status(200).json({
        ok: true,
        tokenFieldUsed: tokenField,
        templates: mapTemplates(records),
      });
    } catch (err) {
      // If this field name is wrong, Airtable will throw. We try the next candidate.
      const msg = String(err?.message || "");
      const isFieldNameIssue =
        msg.toLowerCase().includes("unknown field name") ||
        msg.toLowerCase().includes("invalid filterbyformula") ||
        msg.toLowerCase().includes("formula");

      if (!isFieldNameIssue) {
        // This is a real Airtable failure (permissions/table not found/etc.)
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
      // else: try next tokenField
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
