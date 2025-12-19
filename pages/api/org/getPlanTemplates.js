import Airtable from "airtable";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // --- DEBUG: prove what the server can see (safe, no secrets) ---
  const API_KEY = process.env.PLAN_TEMPLATES_API_KEY;
  const BASE_ID = process.env.PLAN_TEMPLATES_BASE_ID;
  const TABLE = process.env.PLAN_TEMPLATES_TABLE_NAME;

  // Helpful: show if keys exist, but never output actual values
  const debug = {
    nodeEnv: process.env.NODE_ENV || "",
    has_PLAN_TEMPLATES_API_KEY: Boolean(API_KEY),
    has_PLAN_TEMPLATES_BASE_ID: Boolean(BASE_ID),
    has_PLAN_TEMPLATES_TABLE_NAME: Boolean(TABLE),

    // show lengths only (still safe)
    PLAN_TEMPLATES_API_KEY_len: API_KEY ? String(API_KEY).length : 0,
    PLAN_TEMPLATES_BASE_ID_len: BASE_ID ? String(BASE_ID).length : 0,
    PLAN_TEMPLATES_TABLE_NAME_len: TABLE ? String(TABLE).length : 0,
  };

  const missing = [];
  if (!API_KEY) missing.push("PLAN_TEMPLATES_API_KEY");
  if (!BASE_ID) missing.push("PLAN_TEMPLATES_BASE_ID");
  if (!TABLE) missing.push("PLAN_TEMPLATES_TABLE_NAME");

  if (missing.length) {
    return res.status(500).json({
      error:
        "PlanTemplates Airtable env vars missing. Check PLAN_TEMPLATES_API_KEY / PLAN_TEMPLATES_BASE_ID / PLAN_TEMPLATES_TABLE_NAME.",
      missing,
      debug,
    });
  }

  // --- Normal handler below ---
  const headerToken = req.headers["x-org-token"];
  const queryToken = req.query?.token;
  const orgToken = String(headerToken || queryToken || "").trim();

  if (!orgToken) return res.status(400).json({ error: "Missing token" });

  try {
    const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);

    const records = await base(TABLE)
      .select({
        filterByFormula: `{Organization Token} = "${orgToken}"`,
        pageSize: 50,
      })
      .all();

    const templates = records.map((r) => {
      const f = r.fields || {};
      let structured = null;
      try {
        structured = f.Structured ? JSON.parse(f.Structured) : null;
      } catch {
        structured = null;
      }
      return {
        id: r.id,
        name: f.Name || "Template",
        structured,
        createdBy: f["Created By"] || "",
        status: f.Status || "Active",
        notes: f.Notes || "",
        tags: f.Tags || [],
        createdAt: f["Created At"] || f.createdTime || "",
      };
    });

    return res.status(200).json({ ok: true, templates });
  } catch (err) {
    console.error("[getPlanTemplates] Airtable error:", err);
    return res.status(500).json({
      error: "Failed to load plan templates",
      airtable: {
        error: err?.error,
        message: err?.message,
        statusCode: err?.statusCode,
      },
    });
  }
}
